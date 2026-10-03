# SPEC.md — Anchor

> 1-page summary. Verify every claim against actual code before committing.

---

## What it is

**Anchor** is a retrieval layer for pgvector on Next.js 16 + Prisma. It embeds a
query, runs a cosine-similarity search, and returns the matching chunks with
their provenance when the best match clears a similarity floor — otherwise it
returns no answer. No LLM is called. The approach was extracted from an earlier
project, where a weak retrieval was better refused than answered.

---

## Core features (verified in code)

| Feature | Location |
|---|---|
| Vector search with cosine distance (`<=>`) | `src/lib/rag/retriever.ts` |
| 0.30 similarity floor, applied uniformly (`SIM_FLOOR`) | `src/lib/rag/retriever.ts` |
| Adaptive K (6 normal, 10 amenity) — floor unchanged | `src/lib/rag/retriever.ts` |
| 5000ms DB query budget; OpenAI client timeout 8000ms, 1 retry | `src/lib/rag/retriever.ts`, `src/lib/openai.ts` |
| Failure raises `RetrievalError` → route returns 503 | `src/lib/rag/retriever.ts`, `src/app/api/query/route.ts` |
| Tagged `$queryRaw` (no `*RawUnsafe`), eslint-banned | `src/lib/rag/retriever.ts`, `eslint.config.mjs` |
| Chunk sanitation (control/zero-width strip, collapse, cap 2000) | `src/lib/rag/sanitize.ts` |
| Idempotent upsert (unique on `sourceType + sourceId`) | `src/lib/rag/embed-writer.ts` |
| Bulk backfill script with `--dry` mode | `scripts/embed-backfill.ts` |
| Deduped `sources[]` provenance array | `src/lib/rag/sources.ts` |
| Postgres fixed-window rate limiting (20/min IP, 1000/hr global) | `src/lib/rate-limit.ts` |
| Health endpoint probes DB (`SELECT 1`) → `{ok, db}`, 503 on fail | `src/app/api/health/route.ts` |
| Prisma migrations incl. `CREATE EXTENSION vector` and the HNSW index | `prisma/migrations/` |
| 50 tests passing | `tests/*.test.ts` |

Test breakdown: retriever 10, rate-limit 10, query-route 8, sources 7, sanitize 6,
embed-writer 5, retriever-floor 4.

---

## Architecture

```mermaid
graph LR
    Query --> Embed[Embed with\ntext-embedding-3-small]
    Embed --> pgv[pgvector\n<=> cosine search]
    pgv --> Filter[Best score ≥ 0.30\n(k=6 or k=10)]
    Filter --> Return[Return chunks\nor refused]

    subgraph "Write path"
        Entities --> Chunk[chunkForProject\nchunkForBuilder\nchunkForLocality...]
        Chunk --> OpenAI[OpenAI\nembed-3-small]
        OpenAI --> Upsert[Prisma upsert\nEmbedding table]
    end
```

**Retrieval pipeline** (`retrieveChunks(query, k=6)`):
1. Sanitize and embed the query with `text-embedding-3-small`
2. pgvector `<=>` cosine distance search (tagged `$queryRaw`)
3. Filter by similarity ≥ 0.30 (the floor is never lowered by the query)
4. Amenity queries widen K to 10 and boost on-topic location rows
5. Returns `{ chunks, floor, maxSimilarity }`; throws `RetrievalError` on failure

**Embedding pipeline** (`chunkFor{Entity}()` per type):
- `chunkForProject()` — price range in Cr, possession date, amenities, analyst notes
- `chunkForBuilder()` — trust scores, grade (sensitive fields excluded)
- `chunkForLocality()` — YoY growth, demand score, avg price/sqft
- `chunkForInfra()` — infrastructure items with price impact
- `chunkForLocationData()` — points of interest with category-first phrasing

---

## Key design decisions

1. **Cosine floor over top-K only** — pgvector cosine distance is fast and
   deterministic. The 0.30 floor suits the demo corpus; calibrate it per corpus.

2. **Adaptive K vs fixed K** — Amenity queries ("nearest schools") need higher
   recall, so they widen K to 10 and boost on-topic location rows. The floor is
   the same 0.30: recall widens, the bar does not drop.

3. **Idempotent upsert** — `ON CONFLICT (sourceType, sourceId)` means re-running
   `embed:backfill` re-embeds rather than duplicating.

4. **Failure is not refusal** — `retrieveChunks` throws `RetrievalError` when the
   embedding call, the DB query, or the DB budget fails. `/api/query` returns 503.
   Only a genuine below-floor result is a refusal (`refused: true`).

5. **5000ms DB budget** — pgvector queries on Neon serverless can be slow. A query
   exceeding the budget raises `RetrievalError` (see `DB_TIMEOUT_MS` in
   `src/lib/rag/retriever.ts`). The OpenAI client has its own 8000ms timeout.

---

## Tech stack (verified from package.json)

- Next.js ^16.3, React 19.2.7, TypeScript strict
- Prisma 7 + `@prisma/adapter-neon` (Neon HTTP) / `@prisma/adapter-pg` (local Docker Postgres)
- pgvector (PostgreSQL extension)
- OpenAI `text-embedding-3-small`
- Zod 4, js-tiktoken (token counting)

---

## Gaps identified

- No pre-commit hooks
- No LLM generation wired — `/api/query` returns chunks + `sources[]` for the caller to inject
- `/api/health` probes DB connectivity but not the embedder

---

## GitHub topics

Add: `rag`, `pgvector`, `nextjs`, `prisma`, `openai`, `embeddings`, `retrieval`, `typescript`
