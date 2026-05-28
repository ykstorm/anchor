# Deploying Anchor

Three deploy modes:

1. **Local dev** — `docker compose up`, 60 seconds
2. **Vercel + Neon** — production, free tier, anchor.lakshyaraj.dev
3. **Self-hosted** — your Kubernetes, Fly.io, Render, any Postgres-with-pgvector

---

## 1. Local dev (60 seconds)

```bash
git clone https://github.com/ykstorm/anchor && cd anchor
cp .env.example .env
# paste your OPENAI_API_KEY into .env
docker compose up -d
docker compose exec app npm run seed   # ~30s, embeds 10 public-domain docs
open http://localhost:3000/playground
```

Stop: `docker compose down`
Wipe data: `docker compose down -v`

---

## 2. Vercel + Neon (production)

### One-time setup (~10 minutes)

**Neon Postgres:**
1. Sign up at [neon.tech](https://neon.tech) (free tier, no credit card)
2. Create project `anchor-prod`
3. Settings → Extensions → enable `vector` (one click)
4. Copy connection string from dashboard — this is `DATABASE_URL`
5. Copy the direct (non-pooled) connection string — this is `DIRECT_URL`

**Vercel:**
1. Connect your fork of `github.com/ykstorm/anchor` to Vercel
2. Framework preset: Next.js (auto-detected)
3. Environment variables:
   ```
   DATABASE_URL      = <neon pooled connection string>
   DIRECT_URL        = <neon direct connection string>
   OPENAI_API_KEY    = sk-...
   NEXT_PUBLIC_DEMO_MODE = true
   ```
4. Build command override: `npx prisma generate && npx prisma migrate deploy && next build`
5. Deploy.

**Custom domain:**
1. Vercel → Project → Settings → Domains → add `anchor.lakshyaraj.dev`
2. Add CNAME `anchor` → `cname.vercel-dns.com` in your DNS

**Seed the demo corpus:**
```bash
# locally, against the prod DB
DATABASE_URL='<neon prod url>' npm run seed
```

**Expected p50 latency:**
- Cold start: ~1.2s (Vercel serverless)
- Warm: 220ms (embed: 180ms, pgvector: 25ms, provenance lookup: 15ms)

---

## 3. Self-hosted

### Fly.io

```bash
fly launch --copy-config --image ghcr.io/ykstorm/anchor:latest
fly secrets set OPENAI_API_KEY=sk-... DATABASE_URL=postgresql://...
fly deploy
```

A managed Postgres-with-pgvector is available via Fly: `fly postgres create --vector`.

### Render

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
    # Note: install pgvector via Render dashboard → Database → Extensions
```

### Kubernetes

```yaml
# k8s/deployment.yaml — minimal
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

A reference Helm chart is in [`infra/helm/anchor`](./infra/helm/anchor).

---

## Cost estimates

| Mode | Compute | DB | OpenAI | Monthly |
|---|---|---|---|---|
| Local dev | $0 | $0 | ~$0.50 (seeding) | <$1 |
| Vercel Hobby + Neon Free | $0 | $0 | ~$2-5 (light traffic) | ~$5 |
| Vercel Pro + Neon Scale | $20 | $19 | ~$10-50 | $50-90 |
| Self-hosted (k8s, 2 pods) | depends | depends | ~$10-50 | depends |

OpenAI embedding cost: $0.02 per million tokens. A typical query embeds ~50 tokens. 1M queries = $1.

---

## Smoke test after deploy

```bash
HOST=https://anchor.lakshyaraj.dev   # or your URL

# 1. Health
curl -fsS $HOST/api/health
# expected: {"ok":true,"db":"healthy","embedder":"healthy"}

# 2. Known-good query (chunks should return)
curl -fsS -X POST $HOST/api/query \
  -H "Content-Type: application/json" \
  -d '{"q":"What does Anchor do when retrieval fails?"}'
# expected: chunks: [...], refused: false, sources: [...]

# 3. Known-bad query (should be refused)
curl -fsS -X POST $HOST/api/query \
  -H "Content-Type: application/json" \
  -d '{"q":"xkcd 18472 nonexistent gibberish"}'
# expected: chunks: [], refused: true
```

If any smoke test fails, check Vercel logs (`vercel logs`) and Sentry dashboard. Common issues:

- **`vector extension not enabled`** → enable it in Neon dashboard, run `CREATE EXTENSION vector;`
- **`OPENAI_API_KEY missing`** → re-add in Vercel env vars, redeploy
- **`pool exhausted`** → use pooled connection string, not direct
- **timeouts** → check Neon region matches Vercel region

---

## Rollback

Vercel → Deployments → previous deploy → Promote to Production.
Database migrations: Anchor uses `prisma migrate deploy` (forward-only). To rollback, restore Neon branch from a prior point (Neon → Branches → Time travel).
