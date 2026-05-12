# SPEC.md — rag-starter

> 1-page summary. Verify every claim against actual code before committing.

---

## What it is

**rag-starter** is a production-ready RAG (Retrieval-Augmented Generation) template for Next.js 15 + Prisma + pgvector. It provides embed-write and retrieval pipelines that can be dropped into any Next.js project with a PostgreSQL + pgvector database. Extracted from Homesty.ai's buyerchat, where it handles real queries in production.

---

## Core features (verified in code)

| Feature | Location |
|---|---|
| Vector search with cosine distance (`<=>`) | `src/lib/rag/retriever.ts` |
| 0.30 similarity score floor (0.20 for amenity queries) | `src/lib/rag/retriever.ts` |
| Adaptive K (6 normal, 10 amenity) | `src/lib/rag/retriever.ts` |
| 600ms retrieval timeout | `src/lib/rag/retriever.ts` |
| Idempotent upsert (checks existing by `entity_type + entity_id`) | `src/lib/rag/embed-writer.ts` |
| Bulk backfill script with `--dry` mode | `scripts/embed-backfill.ts` |
| Embed functions per entity type | `src/lib/rag/embed-writer.ts` |
| 15 tests passing (embed-writer: 5, retriever: 10) | `tests/*.test.ts` |
| Prisma migration on disk | `prisma/migrations/` |

---

## Architecture

```mermaid
graph LR
    Query --> Embed[Embed with\ntext-embedding-3-small]
    Embed --> pgv[pgvector\n<=> cosine search]
    pgv --> Filter[Score ≥ 0.30\n(k=6 or k=10)]
    Filter --> Return[Return chunks\nor empty]

    subgraph "Write path"
        Entities --> Chunk[chunkForProject\nchunkForBuilder\nchunkForLocality...]
        Chunk --> OpenAI[OpenAI\nembed-3-small]
        OpenAI --> Upsert[Prisma upsert\nEmbedding table]
    end
```

**Retrieval pipeline** (`retrieveChunks(query, k=6)`):
1. Embed query with `text-embedding-3-small`
2. pgvector `<=>` cosine distance search
3. Filter by similarity ≥ 0.30 (amenity: ≥ 0.20)
4. Amenity queries get adaptive K=10 + location boost
5. Returns `[]` on any failure — caller continues normally

**Embedding pipeline** (`embed-{entity}()` per type):
- `chunkForProject()` — price range in Cr, possession date, amenities, analyst notes
- `chunkForBuilder()` — trust scores, grade (sensitive fields excluded)
- `chunkForLocality()` — YoY growth, demand score, avg price/sqft
- `chunkForInfra()` — infrastructure items with price impact
- `chunkForLocationData()` — amenity POIs with category-first phrasing

---

## Key design decisions

1. **0.30 cosine floor over semantic search** — pgvector cosine distance is fast and deterministic. The 0.30 threshold is tuned from production queries on buyerchat — lower values returned too much noise, higher values missed valid context.

2. **Adaptive K vs fixed K** — Amenity queries (e.g., "nearest schools") need higher recall than project queries. The adaptive K (10 vs 6) with a lower score floor (0.20 vs 0.30) handles this without separate retrieval paths.

3. **Idempotent upsert** — `upsert` with `where: { entityType_entityId }` means re-running `embed:backfill` doesn't create duplicates. The embedding for a given entity is always the latest version.

4. **Empty array on failure** — `retrieveChunks` catches all errors and returns `[]`. The caller (chat pipeline) renders PART 17 only when chunks exist. This makes the RAG path fail silently — no crash, no fabricated context.

5. **600ms timeout** — pgvector queries on Neon serverless can be slow. The timeout ensures the chat pipeline doesn't hang on a slow retrieval. On timeout, returns `[]` and logs.

---

## Tech stack (verified from package.json)

- Next.js 15.2.9, React 19.2.4, TypeScript strict
- Prisma 7 + `@prisma/adapter-neon`
- pgvector (PostgreSQL extension)
- OpenAI `text-embedding-3-small`
- Vercel AI SDK, Zod 4, js-tiktoken (token counting)

---

## Gaps identified

- No INTERVIEW_REPORT.md yet (written in this polish)
- No health endpoint (`/api/health`)
- No pre-commit hooks
- CI only runs test + embed-test — no lint step
- Prisma migration exists on disk but is unapplied in fresh clone (documented in README)

---

## GitHub topics

Add: `rag`, `pgvector`, `nextjs`, `prisma`, `openai`, `embeddings`, `retrieval`, `typescript`