# Claim Audit

This file maps every public, user-facing claim about Anchor to the code or
artifact that backs it. You can check each row from a fresh clone.

## Headline behaviour

| Claim (source) | Backed by |
|---|---|
| Returns chunks when the best similarity is at or above the floor, else refuses (README) | `src/lib/rag/retriever.ts` (`SIM_FLOOR` filter) + `src/app/api/query/route.ts` (`refused = chunks.length === 0`) |
| Cosine floor, default 0.30, applied uniformly (README, SPEC) | `src/lib/rag/retriever.ts`: `export const SIM_FLOOR = 0.30` |
| Floor is never lowered by the query text (README, SPEC) | `src/lib/rag/retriever.ts`: the amenity path changes K only; proven by `tests/retriever-floor.test.ts` |
| Adaptive K (6 normal, 10 amenity) (README, SPEC) | `src/lib/rag/retriever.ts`: `effectiveK = isAmenityQuery ? Math.max(k, 10) : k` |
| DB query budget 5000ms; OpenAI client timeout 8000ms, 1 retry (SPEC) | `src/lib/rag/retriever.ts` (`DB_TIMEOUT_MS`), `src/lib/openai.ts` |
| Failure is not refusal: an error returns 503 (README, SPEC) | `src/lib/rag/retriever.ts` (`RetrievalError`) + `src/app/api/query/route.ts` (503); proven by `tests/query-route.test.ts`, `tests/retriever-floor.test.ts` |
| pgvector cosine distance via `<=>`, tagged `$queryRaw` (SPEC) | `src/lib/rag/retriever.ts`: `embedding <=> ${vecStr}::vector` |
| Response reports `floor` and `maxSimilarity` (README, SPEC) | `src/app/api/query/route.ts` |

## Provenance: `sources[]`

| Claim (source) | Backed by |
|---|---|
| Every grounded `/api/query` response includes a structured `sources[]` array (README) | `src/lib/rag/sources.ts` (`buildSources`) wired in `src/app/api/query/route.ts` |
| Each entry carries `sourceId` / `sourceType` provenance (README, docs/architecture.md) | `Source` type in `src/lib/rag/sources.ts` (`{ sourceId, sourceType, similarity, chunkCount }`) |
| `sources[]` deduped across chunks | `src/lib/rag/sources.ts`; proven by `tests/sources.test.ts` and `tests/query-route.test.ts` |
| Refused responses return empty `sources[]` | `buildSources([]) === []`; tested in `tests/sources.test.ts`, `tests/query-route.test.ts` |

## Embedding / write path

| Claim (source) | Backed by |
|---|---|
| OpenAI `text-embedding-3-small`, 1536-dim (README, SPEC) | `src/lib/rag/embed-writer.ts` + `prisma/schema.prisma` (`vector(1536)`) |
| Chunk sanitation on read and write (SPEC) | `src/lib/rag/sanitize.ts` used in `retriever.ts` and `embed-writer.ts`; tested in `tests/sanitize.test.ts` |
| Idempotent upsert by `(sourceType, sourceId)` (SPEC) | `prisma/schema.prisma` `@@unique` + `embed-writer.ts` `ON CONFLICT` |
| A seed run replaces the corpus: rows and chunks outside the demo set are deleted (README, DEPLOY) | `src/lib/rag/demo-seeder.ts` (`removeRowsOutside`), `src/lib/rag/seed-runner.ts` (`removeUnwrittenChunks`); proven by `tests/seed-replace.test.ts` |
| Per-entity chunk templates (SPEC) | `src/lib/rag/embed-writer.ts`: `chunkForProject/Builder/Locality/Infra/LocationData` |
| Builder chunks use only the fields in `BuilderAIContext` (schema comment) | `src/lib/rag/embed-writer.ts` `BuilderAIContext` and `chunkForBuilder`. The `Builder` model has no contact or commission columns at all |

## Endpoints

| Claim (source) | Backed by |
|---|---|
| `/api/query` POST (README, DEPLOY) | `src/app/api/query/route.ts` |
| `/api/query` rate-limited, 415/403/400/429 guards | `src/app/api/query/route.ts` + `src/lib/rate-limit.ts`; tested in `tests/query-route.test.ts`, `tests/rate-limit.test.ts` |
| `/api/health` probes DB, returns `{ok, db}`, 503 on fail (SPEC, DEPLOY) | `src/app/api/health/route.ts` |
| `/playground` interactive query UI (README) | `src/app/playground/page.tsx`, `src/app/playground/playground.tsx`; response handling tested in `tests/playground-query.test.ts` |

## Data / infra

| Claim (source) | Backed by |
|---|---|
| Postgres + pgvector (README, Stack) | `prisma/schema.prisma` `Unsupported("vector(1536)")`, `docker-compose.yml` `pgvector/pgvector:pg16` |
| HNSW index on `Embedding.embedding` (README, SPEC) | `prisma/migrations/20261001090000_add_hnsw_index/migration.sql` |
| Prisma migration with `CREATE EXTENSION vector` (SPEC) | `prisma/migrations/00000000000000_init/migration.sql` |
| `docker compose up -d postgres` gives a local Postgres with the `vector` extension and no tables; the quickstart then runs the migrations and the seed from the host (README quickstart) | `docker-compose.yml` `postgres` service + healthcheck, `prisma/init/01-extensions.sql`. A bare `docker compose up -d` also builds and starts the `app` service on port 3000 |
| Seed loads a 60-row synthetic corpus (README quickstart) | `prisma/seed.ts`, which uses `src/lib/rag/demo-seeder.ts` (16 projects, 5 builders, 4 localities, 4 infra, 31 POIs) |
| Postgres fixed-window rate limiting | `prisma/migrations/20261001090100_add_rate_limit/migration.sql` + `src/lib/rate-limit.ts` |

## Stack versions

| Claim (source) | Backed by |
|---|---|
| Next.js ^16.3 (README Stack, SPEC) | `package.json` `"next": "^16.3.0"` |
| Prisma 7 (README, SPEC) | `package.json` `"@prisma/client": "^7.5.0"` |
| React 19.2.7 (SPEC) | `package.json` `"react": "19.2.7"` |

## Tests

| Claim (source) | Backed by |
|---|---|
| 54 tests passing (SPEC) | `tests/*.test.ts` |
| `detectAmenityCategories` tested against the real source | `tests/retriever.test.ts` imports from `@/lib/rag/retriever` |
| Floor cannot be lowered by query text | `tests/retriever-floor.test.ts` |
| `sources[]` shape + dedup tested | `tests/sources.test.ts`, `tests/query-route.test.ts` |
| Rate limiter and request validation tested | `tests/rate-limit.test.ts`, `tests/query-route.test.ts` |
