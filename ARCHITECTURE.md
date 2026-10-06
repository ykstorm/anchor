# Anchor architecture

Detailed architecture: [docs/architecture.md](docs/architecture.md)

Terms used here (pgvector, cosine similarity, floor, provenance) are defined in the [README](README.md).

## Components

The playground (`app/playground`) posts each query to `POST /api/query`. The
route calls `retrieveChunks`. That function runs the intent classifier
(`detectAmenityCategories`), embeds the query with OpenAI
`text-embedding-3-small` and searches the stored embeddings in Postgres with
pgvector. The retriever hands the matching chunks back to the route, which
returns them to the UI.

## Request sequence: grounded query

1. The client POSTs `{"q": "price of North Court"}` to `/api/query`.
2. The route calls `retrieveChunks(q, 6)`, whose floor defaults to 0.30.
3. `detectAmenityCategories` finds no amenity in the query, so K stays 6.
4. The retriever embeds the sanitized query with `text-embedding-3-small` and
   gets a 1536-dimension vector.
5. pgvector returns the 6 rows nearest by cosine distance (`<=>`), each with
   its similarity, for example 0.71.
6. Rows below 0.30 are dropped, and the retriever returns
   `{ chunks, floor, maxSimilarity }`.
7. The route sets `refused: false` because chunks remain, and answers 200 with
   the chunks, `refused`, `sources`, `floor` and `maxSimilarity`.

## Request sequence: refused query

1. The client POSTs `{"q": "what is xkcd 18472"}` to `/api/query`.
2. The route calls `retrieveChunks(q, 6)`, which embeds the query and asks
   pgvector for the 6 nearest rows.
3. The best of them scores 0.08, so every row is below 0.30 and none is kept.
4. The retriever returns no chunks, with `maxSimilarity` 0.08.
5. The route answers 200 with `chunks: []` and `refused: true`.

## Module map

| Module | File | Purpose |
|---|---|---|
| API handler | `src/app/api/query/route.ts` | POST /api/query: embeds, retrieves, returns chunks or refusal |
| Retriever | `src/lib/rag/retriever.ts` | Core retrieval: embed the query, search pgvector, filter by floor, return |
| Embed-writer | `src/lib/rag/embed-writer.ts` | Per-entity upsert functions: chunkForProject, chunkForBuilder, etc. |
| Demo seeder | `src/lib/rag/demo-seeder.ts` | Replaces the corpus tables with the synthetic demo set |
| Seed runner | `src/lib/rag/seed-runner.ts` | Embeds every corpus row, then deletes the chunks it did not write |
| Prisma client | `src/lib/prisma.ts` | Singleton Prisma client for Next.js |

## Key design decisions

1. Cosine floor instead of top-K only. Most RAG uses top-K (the K best-scoring chunks) and passes whatever comes back to the LLM. Anchor adds a similarity floor (0.30 default). Below that, the retrieval is too weak to be useful, and Anchor returns `refused: true`. This stops the model from answering off a weak match.

2. Wider K for amenity queries. Amenity queries ("schools near North Ridge") vary more in wording, so relevant rows score lower. `retrieveChunks` raises K to at least 10 for them (`retriever.ts`, `effectiveK`) and reranks location rows that name the detected amenity (`rerankAmenity`). The 0.30 floor is the same for every query. Only K changes.

3. Idempotent write on (sourceType, sourceId). The backfill script can be re-run safely. `upsertEmbedding` in `src/lib/rag/embed-writer.ts` runs a raw `INSERT ... ON CONFLICT ("sourceType", "sourceId")`, and the `@@unique` constraint in `prisma/schema.prisma` keeps one embedding per pair. Re-running produces the same rows as running once. A seed run also deletes the chunks it did not write, so a source removed from the corpus stops being served.

## Retrieval timeout

The pgvector query runs under a 5000ms budget (`DB_TIMEOUT_MS` in `retriever.ts`).
Exceeding it raises `RetrievalError`, as does a failed embedding or DB call, and
`/api/query` turns that into a 503. A failure is never reported as a refusal. The
OpenAI client has its own 8000ms timeout (1 retry). A genuine below-floor result
is the only thing that returns empty with `refused: true`.
