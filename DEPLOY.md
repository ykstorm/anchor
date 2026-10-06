# Deploying Anchor

Anchor can be deployed three ways.

1. Local dev: `docker compose up`.
2. Vercel + Neon: the production setup. Vercel hosts the app. Neon hosts the Postgres database. The examples use `anchor.example.com` as a placeholder for your own domain.
3. Self-hosted: on your own Kubernetes, Fly.io, Render, or any Postgres with pgvector. pgvector is the Postgres extension that stores embeddings and searches them by distance. An embedding is a list of numbers that represents the meaning of a text.

---

## 1. Local dev

```bash
git clone https://github.com/ykstorm/anchor && cd anchor
cp .env.example .env
# paste your OPENAI_API_KEY into .env
docker compose up -d
docker compose exec app npm run seed   # seeds the demo corpus (60 rows)
open http://localhost:3000/playground
```

To stop the stack, run `docker compose down`. To stop it and wipe the data, run `docker compose down -v`.

---

## 2. Vercel + Neon (production)

### One-time setup

First, set up Neon Postgres.

1. Sign up at [neon.tech](https://neon.tech).
2. Create a project named `anchor-prod`.
3. Open Settings, then Extensions, and enable `vector`.
4. Copy the connection string from the dashboard. This is `DATABASE_URL`. It goes through a connection pooler, which shares a small set of database connections across many requests.

Then set up Vercel.

1. Connect your fork of `github.com/ykstorm/anchor` to Vercel.
2. Set the framework preset to Next.js. Vercel detects it automatically.
3. Set these environment variables:
   ```
   DATABASE_URL      = <neon pooled connection string>
   OPENAI_API_KEY    = sk-...
   ```
4. Override the build command with `npx prisma generate && npx prisma migrate deploy && next build`.
5. Deploy.

`docker-compose.yml` also sets `DIRECT_URL` and `NEXT_PUBLIC_DEMO_MODE`. Nothing in the code reads either one, so you do not need to set them on Vercel.

To use a custom domain:

1. In Vercel, open Project, then Settings, then Domains, and add `anchor.example.com`.
2. In your DNS, add a CNAME record named `anchor` that points to `cname.vercel-dns.com`. A CNAME is a DNS record that makes one name an alias for another.

To seed the demo corpus, run this locally against the production database:

```bash
# locally, against the prod DB
DATABASE_URL='<neon prod url>' npm run seed
```

Two notes on latency.

- The DB-side vector search takes about 1 to 3 ms on the benchmark table. See the performance table in the README and `bench/latency-scale.mjs`.
- End-to-end latency is dominated by the OpenAI embedding API call. That call is not benchmarked here, and it varies with API load. A Vercel cold start adds its own one-off cost. A cold start is the extra time it takes to start a function that has been idle.

---

## 3. Self-hosted

Fly.io and Render are hosting services that can run a Docker image.

### Fly.io

Untested: these steps have not been run, and the repo has no `fly.toml`.

```bash
fly launch --copy-config --image ghcr.io/ykstorm/anchor:latest
fly secrets set OPENAI_API_KEY=sk-... DATABASE_URL=postgresql://...
fly deploy
```

Fly can also run a managed Postgres with pgvector: `fly postgres create --vector`.

### Render

Untested: these steps have not been run, and the repo has no `render.yaml`.

```yaml
# render.yaml
services:
  - type: web
    name: anchor
    runtime: docker
    image:
      url: ghcr.io/ykstorm/anchor:latest
    envVars:
      - key: OPENAI_API_KEY
        sync: false
      - key: DATABASE_URL
        fromDatabase:
          name: anchor-postgres
          property: connectionString
databases:
  - name: anchor-postgres
    plan: starter
    postgresMajorVersion: 16
    # install pgvector via Render dashboard → Database → Extensions
```

### Kubernetes

Untested: these manifests have not been applied, and the repo has no `k8s/` folder.

Kubernetes runs containers across a cluster of machines.

```yaml
# k8s/deployment.yaml (minimal)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: anchor
spec:
  replicas: 2
  selector:
    matchLabels: { app: anchor }
  template:
    metadata:
      labels: { app: anchor }
    spec:
      containers:
        - name: anchor
          image: ghcr.io/ykstorm/anchor:latest
          ports: [{ containerPort: 3000 }]
          envFrom:
            - secretRef: { name: anchor-secrets }
          livenessProbe:
            httpGet: { path: /api/health, port: 3000 }
            initialDelaySeconds: 15
          readinessProbe:
            httpGet: { path: /api/health, port: 3000 }
            initialDelaySeconds: 5
          resources:
            requests: { cpu: 100m, memory: 256Mi }
            limits:   { cpu: 500m, memory: 512Mi }
```

Both probes call `/api/health`. Kubernetes restarts a pod that fails the liveness probe. It stops sending traffic to a pod that fails the readiness probe.

The manifest above is a minimal starting point. There is no bundled Helm chart. Helm is a package manager for Kubernetes.

---

## Cost estimates

The main running cost is the OpenAI embedding calls. Compute and database costs depend on the plan you pick with Vercel, Neon or your own host. Check each vendor's pricing page for current prices.

The backfill script, `scripts/embed-backfill.ts`, estimates embedding cost at $0.02 per million tokens for `text-embedding-3-small`. A token is a small piece of text, about a short word. Assume a query is about 50 tokens. Then 1M queries are 50M tokens, which cost $1 at that price.

---

## Smoke test after deploy

A smoke test is a quick check that the basics work. After a deploy, run these three checks.

```bash
HOST=https://anchor.example.com   # or your URL

# 1. Health (liveness)
curl -fsS $HOST/api/health
# expected: {"ok":true,"db":true}

# 2. Known-good query (chunks should return), matches the seeded corpus
curl -fsS -X POST $HOST/api/query \
  -H "Content-Type: application/json" \
  -d '{"q":"Which Builder A projects in North Ridge are ready to move in?"}'
# expected: chunks: [...], refused: false, sources: [...]

# 3. Known-bad query (should be refused)
curl -fsS -X POST $HOST/api/query \
  -H "Content-Type: application/json" \
  -d '{"q":"xkcd 18472 nonexistent gibberish"}'
# expected: chunks: [], refused: true, sources: []
```

If any check fails, look at the Vercel logs with `vercel logs`. These are the responses and log lines the code produces.

- `/api/health` returns 503 with `{"ok":false,"db":false}` when its `SELECT 1` against the database fails (`src/app/api/health/route.ts`). Check `DATABASE_URL` and that the database is reachable.
- `/api/query` returns 503 with `{"error":"Retrieval temporarily unavailable"}` and logs `[query] retrieval failed:` followed by a reason (`src/app/api/query/route.ts`). The reason is one of the four below.
  - `rate limit check failed` means the rate limiter could not write its count to the `RateLimit` table. It runs before anything else touches the database, so this is usually the first sign that the database is down. Check `DATABASE_URL` and that the database is reachable.
  - `embedding failed` means the call to OpenAI failed. Check that `OPENAI_API_KEY` is set in the Vercel environment variables, then redeploy.
  - `db query timed out` means the vector search ran past its 5 second limit. Check that the Neon region matches the Vercel region.
  - `db query failed` means the database query itself failed. Check `DATABASE_URL` and that the migrations were applied.
- `npm run seed` prints `[seed] OPENAI_API_KEY not set, skipping embedding step.` when the key is missing (`prisma/seed.ts`). It still seeds the structured rows. Set the key and run it again.

---

## Rollback

To roll back the app, open Deployments in Vercel, pick a previous deploy, and choose Promote to Production.

Anchor applies database migrations with `prisma migrate deploy`, which only moves forward. A migration is a script that changes the database structure. To roll the database back, restore a Neon branch from an earlier point in time. In Neon, open Branches, then Time travel.
