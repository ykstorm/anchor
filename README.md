# Anchor

[![CI](https://github.com/ykstorm/anchor/actions/workflows/ci.yml/badge.svg)](https://github.com/ykstorm/anchor/actions/workflows/ci.yml)
[![Docker build](https://img.shields.io/github/actions/workflow/status/ykstorm/anchor/ci.yml?label=docker+build)](https://github.com/ykstorm/anchor/actions)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](tsconfig.json)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](package.json)
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
├── src/lib/rag/               # retriever, embed-writer, demo-seeder, seed-runner
├── prisma/                    # schema + pgvector extension
├── scripts/                   # embed-backfill, calibrate-floor, e2e
├── tests/                     # retriever + embed-writer unit tests
├── docs/architecture.md       # full system architecture + sequence diagrams
├── docker-compose.yml         # Postgres + pgvector + app
├── Dockerfile                 # multi-stage production image
├── SPEC.md                    # feature inventory + code locations
└── INTERVIEW_REPORT.md        # design decisions
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
# Refused state
curl -X POST https://anchor-iota-ten.vercel.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"q":"xkcd 18472 nonsense gibberish"}'
# → {"chunks":[],"refused":true}

# Grounded state
curl -X POST https://anchor-iota-ten.vercel.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"q":"What does Anchor do when retrieval fails?"}'
# → {"chunks":[...],"refused":false}
```

---

## Stack

| Layer | Choice |
|---|---|
| Vector DB | Postgres + pgvector |
| ORM | Prisma 7 |
| API | Next.js 15 (App Router) |
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

## Try locally

```bash
git clone https://github.com/ykstorm/anchor.git && cd anchor
cp .env.example .env  # add OPENAI_API_KEY, DATABASE_URL
npm install && npx prisma migrate dev && npx tsx prisma/seed.ts
npm run dev
```

---

## License

Apache 2.0 — see [LICENSE](LICENSE).