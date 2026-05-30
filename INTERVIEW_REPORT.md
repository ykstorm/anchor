# rag-starter — Interview Report

## What I built

rag-starter is a RAG pipeline template for Next.js 15 + Prisma + pgvector. It gives you two things: a retrieval function that embeds a query and returns relevant chunks from a vector database, and an embedding pipeline that chunks entity data and upserts it to the database.

The project started as part of buyerchat — the AI chat needed to know real project prices and amenities, and GPT-4o hallucinated when given no grounding data. I needed retrieval-augmented generation: embed the query, find relevant context, inject into the system prompt. The pipeline lives in `src/lib/rag/retriever.ts` and `src/lib/rag/embed-writer.ts`.

---

## Why I built it

buyerchat's chat pipeline was generating confident wrong answers. A buyer would ask "what's the possession date for Gala Silver Palm?" and GPT-4o would make up a date. The model had no access to the actual database.

The solution was RAG. But I didn't want to add latency — a naive RAG implementation could add 500ms+ to every response. My goal was keeping retrieval fast enough that it would not be the bottleneck. pgvector on well-indexed Postgres handles typical query loads without issues.

I extracted the pipeline into rag-starter so I could reuse it in other projects. The embed functions (`chunkForProject`, `chunkForBuilder`, etc.) are generic enough to work with any entity schema.

---

## The hardest part — score floor calibration

pgvector returns a cosine similarity score between 0 and 1. The question was: what score means "relevant enough" to include in the context?

I ran the retrieval on a sample of production query logs and looked at the results below different thresholds. Below 0.30, the retrieved chunks were mostly noise — wrong localities, outdated prices, wrong configurations. The threshold needed to be high enough to filter that out.

But amenity queries broke the pattern. "Schools near Bopal" would return items with "school" in the text but varying similarity scores. A flat 0.30 threshold missed valid results. I needed a lower threshold (0.20) for amenity queries, with a higher K (10 vs 6) to compensate for the lower precision.

This is documented in `retriever.ts` as adaptive K: normal queries get K=6 with simFloor=0.30, amenity queries get K=10 with simFloor=0.20.

---

## The second hardest part — idempotent upsert

The backfill script can be re-run. It needs to upsert embeddings, not insert duplicates. If `embed:backfill` runs twice, the second run should update existing embeddings, not create new ones.

The solution was a Prisma `upsert` with a unique constraint on `(entityType, entityId)`. Every embed function calls upsert, not create. The constraint is defined in the Prisma schema on the `Embedding` model.

---

## What I'd change

**Add a vector index hint** — pgvector's `<=>` operator works best with an HNSW index on the embedding column. The current schema doesn't explicitly create one. For production, I'd add `CREATE INDEX ON "Embedding" USING hnsw (embedding vector_cosine_ops)` after migration.

**Streaming retrieval** — right now `retrieveChunks` is synchronous. For very large retrieval sets, a streaming approach (return chunks as they arrive) would be faster. The chat pipeline couldn't use it anyway (needs all chunks before rendering PART 17), but for other use cases it would matter.

**Type-safe embed functions** — the chunk functions take a generic entity object and format it. I'd add Zod schemas for each entity type so the embed function signatures are type-checked at compile time.

---

## What I learned

**pgvector cosine similarity** — cosine distance measures the angle between two vectors, not their magnitude. This means embeddings for short and long text are comparable, which is what you want for a RAG pipeline.

**Embedding model choice** — `text-embedding-3-small` is faster and cheaper than `text-embedding-ada-002`, with comparable quality for retrieval tasks. The 1536-dimension output is the industry standard.

**Neon serverless constraints** — Neon runs PostgreSQL on a serverless tier. Connection pooling behaves differently than a regular PostgreSQL instance. The `DIRECT_URL` vs `DATABASE_URL` split (pooled for runtime, direct for migrations) is documented in the `.env.example`.

---

## Numbers that matter

- 15 tests passing (embed-writer: 5, retriever: 10)
- 0.30 cosine similarity floor (normal queries)
- 0.20 cosine similarity floor (amenity queries)
- 600ms retrieval timeout
- Adaptive K: 6 (normal) vs 10 (amenity)
- 5 embed functions (project, builder, locality, infra, locationData)

---

## For the interview

Be ready to explain:
- Why cosine similarity for vector search (answer: angle-based, magnitude-invariant, works for short and long text equally)
- How the adaptive K / score floor decision was made (answer: ran production queries, tuned thresholds)
- Why upsert instead of insert (answer: re-runnable backfill, no duplicates)
- What happens on retrieval failure (answer: returns empty array, caller continues normally — fail silently)

This project lives at: github.com/ykstorm/rag-starter