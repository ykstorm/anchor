# Anchor

[![CI](https://github.com/ykstorm/anchor/actions/workflows/ci.yml/badge.svg)](https://github.com/ykstorm/anchor/actions/workflows/ci.yml)
[![Docker build](https://img.shields.io/github/actions/workflow/status/ykstorm/anchor/ci.yml?label=docker+build)](https://github.com/ykstorm/anchor/actions)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](tsconfig.json)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Retrieval for pgvector that returns no answer when the best match is too weak, and names the source of every chunk it returns.**

Anchor embeds a query, runs a cosine-similarity search over a pgvector table, and
returns the matching chunks with their provenance when the best match clears a
similarity floor. When nothing clears the floor it returns an empty result
flagged `refused`, along with the floor and the best similarity it saw, so the
caller can tell a real miss from a weak guess. No LLM is called; this is the
retrieval layer a model would sit on top of.

The approach was extracted from an earlier project, where answering a buyer's
question with a confident guess was worse than saying the information was not in
the sources.

**Live demo:** [anchor-iota-ten.vercel.app](https://anchor-iota-ten.vercel.app)
**Playground:** [anchor-iota-ten.vercel.app/playground](https://anchor-iota-ten.vercel.app/playground)

---

## The idea

Most RAG examples take the top-K chunks and hand them to the model regardless of
how weak the match is. A cosine similarity of 0.12 between the query and the
closest chunk is not a basis for an answer, but a top-K-only pipeline passes it
on anyway and the model produces a plausible, cited, wrong answer. Anchor applies
a similarity floor first: below it, there is no answer to give.

The floor is a property of the corpus, not a universal constant. The default
`0.30` separates answerable from unanswerable queries on the seeded demo corpus;
a different corpus will want a different number, found by comparing the
similarity distributions of queries you know are answerable against ones you know
are not.

---

## Project layout

```
anchor/
├── src/app/api/               # API routes (query, health, admin/seed)
├── src/app/playground/        # /playground — interactive query UI
├── src/lib/rag/               # retriever, embed-writer, sources, sanitize, demo-seeder, seed-runner
├── src/lib/                   # prisma client, openai factory, rate limiter
├── prisma/                    # schema + migrations (incl. CREATE EXTENSION vector + HNSW index) + seed.ts
├── scripts/                   # embed-backfill
├── tests/                     # retriever, embed-writer, sources, sanitize, rate-limit, query-route tests
├── docs/architecture.md       # system architecture + sequence diagrams
├── docs/CLAIM_AUDIT.md        # every public claim → file:line that backs it
├── docker-compose.yml         # Postgres + pgvector + app
├── Dockerfile                 # multi-stage production image
└── SPEC.md                    # feature inventory + code locations
```

---

## Architecture overview

```
Query → Embed → pgvector cosine similarity → {best score ≥ floor?} → Yes: chunks + sources / No: refused
```

- **Cosine floor.** Configurable threshold (default 0.30). Below it the result is empty and `refused` is true. The floor is never lowered by the query text.
- **Adaptive K.** Precision queries use K=6; amenity queries widen to K=10 and boost on-topic location rows, but keep the same floor.
- **Provenance.** Every chunk carries its `sourceId`; the response includes a deduped `sources[]` array.
- **Failure is not refusal.** An embedding or database error raises `RetrievalError` and the route returns 503 — never a silent empty "no answer".

---

## Live demo

```bash
# Refused state (off-topic for the seeded corpus)
curl -X POST https://anchor-iota-ten.vercel.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"q":"xkcd 18472 nonsense gibberish"}'
# → {"chunks":[],"refused":true,"sources":[],"floor":0.3,"maxSimilarity":0.07}

# Grounded state (matches the seeded demo corpus)
curl -X POST https://anchor-iota-ten.vercel.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"q":"Which Builder A projects in North Ridge are ready to move in?"}'
# → {"chunks":[...],"refused":false,"sources":[{"sourceId":"...","sourceType":"project","similarity":0.7,"chunkCount":2}, ...]}
```

> The seeded corpus is a synthetic real-estate dataset of invented placeholders —
> 16 projects, 5 builders, 4 localities, 4 infra items, 31 points of interest (60
> rows). On-topic queries about those entities retrieve; anything else is refused.

---

## Performance

Retrieval is a pgvector HNSW cosine search over the `Embedding` table. Measured in
CI (GitHub Actions `ubuntu-latest`, Node 20, `pgvector/pgvector:pg16` service) at
three corpus sizes — 1536-dim vectors, `vector_cosine_ops` HNSW index, k=6, 300
queries each:

| Vectors | p50 | p95 | p99 |
|---|---|---|---|
| 1,000 | **0.94 ms** | 1.06 ms | 1.32 ms |
| 10,000 | **1.47 ms** | 1.86 ms | 2.25 ms |
| 100,000 | **2.59 ms** | 3.51 ms | 4.48 ms |

That is the **DB-side vector search only** (query plus round-trip on the bench
table) — roughly 1–3 ms. It excludes the upstream embedding API call, which
dominates end-to-end latency and is not benchmarked here. The numbers above come
from [`.github/workflows/benchmark.yml`](.github/workflows/benchmark.yml).
Reproduce locally with `node bench/latency-scale.mjs` (Postgres + pgvector via
Docker; random vectors, no API key — see the script header).

---

## Stack

| Layer | Choice |
|---|---|
| Vector DB | Postgres + pgvector |
| ORM | Prisma 7 |
| API | Next.js 16 (App Router) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Deploy | Vercel |
| License | Apache 2.0 |

A small, single-service codebase — no framework beyond Next.js, no managed service.

---

## Known limitations

- **No LLM generation.** Retrieval-only. Wire it to your model's system prompt yourself.
- **Small demo corpus.** 16 projects of synthetic data — not 100k+ documents.
- **Single-stage retrieval.** No re-ranking, no hybrid BM25.

---

## Quickstart (clean machine, <5 min)

The only thing you bring is an `OPENAI_API_KEY`. Docker provides Postgres +
pgvector — no hosted database required.

```bash
# 1. Clone
git clone https://github.com/ykstorm/anchor.git && cd anchor

# 2. Configure — open .env, paste your OPENAI_API_KEY, and set DATABASE_URL to
#    the local docker string documented in .env.example:
#    postgresql://anchor:anchor@localhost:5432/anchor?sslmode=disable
cp .env.example .env

# 3. Start Postgres + pgvector (creates the `vector` extension on first boot)
docker-compose up -d

# 4. Install deps
npm install

# 5. Provision the schema (applies prisma/migrations — tables, vector column, HNSW index)
npx prisma migrate deploy

# 6. Seed the corpus (60 rows) and embed it into pgvector
npm run seed

# 7. Run
npm run dev
```

Open **http://localhost:3000/playground** and try:

- `Which Builder A projects in North Ridge are ready to move in?` → **retrieved** (chunks + `sources[]`)
- `xkcd 18472 nonsense gibberish` → **refused** (`refused: true`, empty `chunks`, empty `sources`)

> `npm run seed` needs `OPENAI_API_KEY` to embed. Without a key it still seeds
> the structured rows and tells you to re-run once the key is set.

---

## Security & credentials

Secrets live only in `.env`, which is gitignored — `.env.example` ships
placeholders (`REPLACE_ME`) and the local docker default, nothing real.
Connection strings in `docker-compose.yml`, CI, and the `Dockerfile` are
throwaway local/CI values, overridable via environment variables.

If a credential is ever exposed (commit, log, screenshot, CI output), **rotate
it** — provision a replacement, update every environment, then revoke the old
one. Full steps are in
[SECURITY.md → Credential rotation](SECURITY.md#credential-rotation).

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
