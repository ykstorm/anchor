# Anchor system architecture

## Why this document exists

Most RAG system diagrams show only the happy path: query, embed, search, answer.
RAG (retrieval-augmented generation) means fetching relevant text and giving it
to a language model to answer from. The happy-path diagrams hide where things go
wrong. This document traces both paths, the match and the miss, and says what
each check catches.

Terms such as pgvector, cosine similarity, floor and provenance are defined in
the [README](../README.md).

---

## 1. Component map

Read path: the Next.js playground (`app/playground`) posts to the
`/api/query` POST handler, which calls the retriever (`retriever.ts`). The
retriever runs the intent classifier, embeds the query with OpenAI
`text-embedding-3-small` and searches Postgres with pgvector. The handler adds
provenance from `sources.ts` and returns the result to the UI.

Write path: `npm run seed` (`prisma/seed.ts`) and `npm run embed:backfill`
(`scripts/embed-backfill.ts`) run each row through a domain chunker
(`chunkForProject` and the others), embed the text with the same model and
store it in the embedding table in Postgres.

`/api/health` checks the database with `SELECT 1`.

---

## 2. Read path: query sequence

1. The user's query, `{"q": "schools near North Ridge"}`, reaches
   `POST /api/query`, which calls `retrieveChunks(q, 6)`.
2. Inside the retriever the intent classifier (`detectAmenityCategories`)
   finds an amenity, so K becomes 10. The floor stays 0.30.
3. The retriever embeds `sanitize(q)` under the client's 8000ms timeout and
   gets a 1536-dimension vector.
4. pgvector runs `ORDER BY embedding <=> q_vec LIMIT 10` under the 5000ms
   budget and returns 10 candidates with scores.
5. Candidates below 0.30 are dropped, and location rows that name the amenity
   are ranked higher.
6. The route adds `sources` from `buildSources` (sourceType, sourceId,
   similarity and chunkCount per source) and answers 200 with the chunks,
   `refused`, `floor` and `maxSimilarity`.

After step 6, one of two things happens:

- Some chunks are left. `refused` is false, and the caller's LLM answers, citing the sources.
- None are left. `refused` is true, and the caller replies "I don't have a source for that."

The no-answer path matters. When `chunks` is empty and `refused` is true, the
caller must not synthesize an answer from the model's prior knowledge. It should
fall back: ask a clarifying question, point to documentation, or hand off to a
human. This deliberate miss is what a naive top-K retriever lacks.

A failure is not a miss. An embedding or DB error raises `RetrievalError` and the
route returns 503, so the caller never mistakes a broken dependency for "no answer".
The rate limiter writes to the database before retrieval starts; if that write
fails, the route returns the same 503 without calling the embedder.

---

## 3. Write path: document ingestion

1. The operator runs `npm run seed` (`prisma/seed.ts`).
2. The script seeds the demo rows, then reads them back from the seeded tables.
3. For each row, the entity's chunker (`chunkFor<Entity>(row)`) builds the
   chunk text.
4. `upsertEmbedding` sanitizes that text and embeds it as a 1536-dimension
   vector.
5. It writes sourceType, sourceId, content, token count and vector to the
   embedding table with
   `INSERT ... ON CONFLICT ("sourceType", "sourceId") DO UPDATE`, so a re-run
   updates rows instead of duplicating them.
6. The script reports how many rows it embedded.

---

## 4. The checks that make a miss safe

Three checks, all in this repo:

| # | Check | Where it lives | What it catches |
|---|---|---|---|
| 1 | Cosine floor | `retriever.ts` (`SIM_FLOOR` filter) | Top-K results that are returned but too weak to answer from |
| 2 | Failure is not refusal | `retriever.ts` (`RetrievalError`), then `api/query` 503 | A broken embedder/DB reported as a false "no answer" |
| 3 | Provenance | `sources.ts` (`buildSources`) | A chunk coming out without a named source |

The floor is never lowered by the query text. Amenity queries widen K and boost
on-topic location rows, but a weak match stays a refusal.

---

## 5. Failure modes (intentional)

| Situation | Anchor behavior |
|---|---|
| All candidates below the floor | Empty chunks + `refused: true` + `maxSimilarity` reported |
| DB query exceeds the 5000ms budget | `RetrievalError`, 503 (not a refusal) |
| Embedding call fails | `RetrievalError`, 503 (not a refusal) |
| DB connection drops | 503 and a `[query] retrieval failed:` log line, whether the rate-limit write or the search fails first |
| Malformed request (bad JSON, empty `q`, non-JSON body, foreign Origin) | 400 / 415 / 403 before any embedding call |
| Too many requests | 429 + `Retry-After` (20/min per caller, 1000/hr global) |
| Duplicate seed run | Idempotent upsert on `(sourceType, sourceId)` |

---

## 6. What's intentionally out of scope (v0.1)

- Re-ranking. A cross-encoder rerank pass (a model that scores each query and chunk pair together) would improve quality at a latency cost. Not shipped.
- Hybrid retrieval (BM25 + vector). BM25 is a keyword-ranking function. Proper nouns hurt pure vector search, so hybrid is future work.
- Multi-tenant isolation. The Postgres schema is single-tenant; there is no per-tenant namespace.
- Streaming. Anchor returns chunks synchronously. Streaming a model response is the caller's job.

---

## 7. Deployment topology (production)

Users reach the Anchor Next.js app, running as Vercel serverless functions,
over HTTPS. The app connects to Neon Postgres (with pgvector) through the
pooled connection string and calls the OpenAI embeddings API.

- Compute: Vercel serverless functions (Node runtime).
- Database: Neon Postgres (free tier supports pgvector, with branching for preview deploys).
- Embedder: OpenAI text-embedding-3-small (~$0.02 per million tokens; latency depends on load).
- Observability: Vercel Analytics for page latency (query strings stripped before send).

Self-hosted alternative: any Postgres with pgvector + any Node runtime.
