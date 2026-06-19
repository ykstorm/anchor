# Anchor

[![CI](https://github.com/ykstorm/anchor/actions/workflows/ci.yml/badge.svg)](https://github.com/ykstorm/anchor/actions/workflows/ci.yml)
[![Docker build](https://img.shields.io/github/actions/workflow/status/ykstorm/anchor/ci.yml?label=docker+build)](https://github.com/ykstorm/anchor/actions)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](tsconfig.json)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Provenance-first RAG that refuses to hallucinate.**

A retrieval layer that returns a grounded answer when similarity is high, and explicitly refuses when it isn't — no fabrication, no hedging.

**Live demo:** [anchor-iota-ten.vercel.app](https://anchor-iota-ten.vercel.app)
**Playground:** [anchor-iota-ten.vercel.app/playground](https://anchor-iota-ten.vercel.app/playground)

---

## The problem

RAG tutorials show the happy path. Production lives in the unhappy path.

A cosine similarity of 0.12 between the query and the closest chunk in your corpus is not a foundation for a confident answer — but most RAG systems feed it to the LLM anyway and get a plausible-sounding fabrication. Anchor treats that signal for what it is: too weak to use.

---

## Project layout

```
anchor/
├── src/app/api/               # API routes (query, chat, health, admin/seed)
├── src/app/playground/        # /playground — interactive query UI
├── src/lib/rag/               # retriever, embed-writer, sources, demo-seeder, seed-runner
├── prisma/                    # schema + migrations (incl. CREATE EXTENSION vector) + seed.ts
├── scripts/                   # embed-backfill, calibrate-floor, e2e
├── tests/                     # retriever, embed-writer, sources, query-route tests
├── docs/architecture.md       # full system architecture + sequence diagrams
├── docs/CLAIM_AUDIT.md        # every public claim → file:line that backs it
├── docker-compose.yml         # Postgres + pgvector + app
├── Dockerfile                 # multi-stage production image
└── SPEC.md                    # feature inventory + code locations
```

---

## Architecture overview

```
Query → Embed → pgvector cosine similarity → {score ≥ floor?} → Yes: Return chunks + sources / No: Return refused
```

- **Cosine floor.** Configurable threshold (default 0.30). Below it → empty result, explicit refusal.
- **Adaptive K.** Precision queries get K=6, recall queries get K=10.
- **Provenance.** Every chunk carries its `sourceId`. The API response includes a structured `sources[]` array.

---

## Live demo

```bash
# Refused state (off-topic for the seeded corpus)
curl -X POST https://anchor-iota-ten.vercel.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"q":"xkcd 18472 nonsense gibberish"}'
# → {"chunks":[],"refused":true,"sources":[]}

# Grounded state (matches the seeded corpus — Ahmedabad real-estate)
curl -X POST https://anchor-iota-ten.vercel.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"q":"Which Goyal & Co. projects in Shela are ready to move in?"}'
# → {"chunks":[...],"refused":false,"sources":[{"sourceId":"...","sourceType":"project","similarity":0.7,"chunkCount":2}, ...]}
```

> The seeded corpus is the Ahmedabad (Shela / South Bopal / Bopal) real-estate
> dataset — 16 projects, 5 builders, 4 localities, 4 infra items, 31 POIs.
> On-topic queries about those entities retrieve; anything else is refused.

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

~970 LOC. No framework, no managed service.

---

## Known limitations

- **No LLM generation.** Retrieval-only. Wire it to your model's system prompt yourself.
- **Small demo corpus.** 16 projects — not 100k+ documents.
- **Single-stage retrieval.** No re-ranking, no hybrid BM25. The `afterRetrieve(chunks)` hook is exposed.

---

## Quickstart (clean machine, <5 min)

The only thing you bring is an `OPENAI_API_KEY`. Docker provides Postgres +
pgvector — no hosted database required.

```bash
# 1. Clone
git clone https://github.com/ykstorm/anchor.git && cd anchor

# 2. Configure — open .env and paste your OPENAI_API_KEY.
#    DATABASE_URL is already set for the docker-compose Postgres.
cp .env.example .env

# 3. Start Postgres + pgvector (creates the `vector` extension on first boot)
docker-compose up -d

# 4. Install deps
npm install

# 5. Provision the schema (applies prisma/migrations — tables + vector column)
npx prisma migrate deploy

# 6. Seed the corpus (60 rows) and embed it into pgvector
npm run seed

# 7. Run
npm run dev
```

Open **http://localhost:3000/playground** and try:

- `Which Goyal & Co. projects in Shela are ready to move in?` → **retrieved** (chunks + `sources[]`)
- `xkcd 18472 nonsense gibberish` → **refused** (`refused: true`, empty `chunks`, empty `sources`)

> `npm run seed` needs `OPENAI_API_KEY` to embed. Without a key it still seeds
> the structured rows and tells you to re-run once the key is set.

---

## License

Apache 2.0 — see [LICENSE](LICENSE).