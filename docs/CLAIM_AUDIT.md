# Claim Audit

Every public, user-facing claim about Anchor mapped to the code or artifact that
backs it. Each row is verifiable from a fresh clone. Line numbers reflect the
state at the time this PR (`fix/real-e2e`) merges.

## Headline behaviour

| Claim (source) | Backed by |
|---|---|
| "Refuses to hallucinate" — returns chunks when similarity ≥ floor, else refuses (README) | `src/lib/rag/retriever.ts` (`effectiveSimFloor` filter) + `src/app/api/query/route.ts` (`refused = chunks.length === 0`) |
| Cosine floor, default 0.30 (README, SPEC) | `src/lib/rag/retriever.ts` — `simFloor: number = 0.30` |
| Amenity queries lower the floor to 0.20 (SPEC) | `src/lib/rag/retriever.ts` — `effectiveSimFloor = isAmenityQuery ? 0.2 : simFloor` |
| Adaptive K (6 normal, 10 amenity) (README, SPEC) | `src/lib/rag/retriever.ts` — `effectiveK = isAmenityQuery ? Math.max(k, 10) : k` |
| Retrieval timeout 1500ms (5000ms amenity) (SPEC) | `src/lib/rag/retriever.ts` — `dbBudgetMs = isAmenityQuery ? 5000 : 1500` |
| pgvector cosine distance via `<=>` (SPEC) | `src/lib/rag/retriever.ts` — `embedding <=> $1::vector` |
| Returns `[]` on any failure (SPEC design decision 4) | `src/lib/rag/retriever.ts` — `catch { return [] }` |

## Provenance — `sources[]`

| Claim (source) | Backed by |
|---|---|
| "The API response includes a structured `sources[]` array" (README:54) | `src/lib/rag/sources.ts` (`buildSources`) wired in `src/app/api/query/route.ts` + `src/app/api/chat/route.ts` |
| Each entry carries `sourceId` / `sourceType` provenance (README, docs/architecture.md) | `Source` type in `src/lib/rag/sources.ts` (`{ sourceId, sourceType, similarity, chunkCount }`) |
| `sources[]` deduped across chunks | `src/lib/rag/sources.ts` (dedup by `${sourceType}:${sourceId}`) — proven by `tests/sources.test.ts` and `tests/query-route.test.ts` |
| Refused responses return empty `sources[]` (DEPLOY smoke test) | `buildSources([]) === []` — `tests/sources.test.ts`, `tests/query-route.test.ts` |

## Embedding / write path

| Claim (source) | Backed by |
|---|---|
| OpenAI `text-embedding-3-small`, 1536-dim (README, SPEC) | `src/lib/rag/embed-writer.ts` + `prisma/schema.prisma` (`vector(1536)`) |
| Idempotent upsert by `(sourceType, sourceId)` (SPEC) | `prisma/schema.prisma` `@@unique([sourceType, sourceId])` + `embed-writer.ts` `ON CONFLICT` |
| Per-entity chunk templates (SPEC) | `src/lib/rag/embed-writer.ts` — `chunkForProject/Builder/Locality/Infra/LocationData` |
| Sensitive builder fields excluded from AI context (schema comment) | `src/lib/rag/embed-writer.ts` `BuilderAIContext` (no contact/commission fields) |

## Endpoints

| Claim (source) | Backed by |
|---|---|
| `/api/query` POST (README, DEPLOY) | `src/app/api/query/route.ts` |
| `/api/chat` POST (README) | `src/app/api/chat/route.ts` |
| `/api/health` exists, returns `{"ok":true}` (SPEC, DEPLOY) | `src/app/api/health/route.ts` |
| `/playground` interactive query UI (README) | `src/app/playground/page.tsx` |

## Data / infra

| Claim (source) | Backed by |
|---|---|
| Postgres + pgvector (README, Stack) | `prisma/schema.prisma` `Unsupported("vector(1536)")`, `docker-compose.yml` `pgvector/pgvector:pg16` |
| Prisma migration on disk with `CREATE EXTENSION vector` (SPEC) | `prisma/migrations/00000000000000_init/migration.sql` |
| `docker-compose up -d` gives a local DB (README quickstart) | `docker-compose.yml` `postgres` service + healthcheck |
| Seed loads a coherent corpus (README quickstart) | `prisma/seed.ts` → `src/lib/rag/demo-seeder.ts` (16 projects, 5 builders, 4 localities, 4 infra, 31 POIs) |
| `npm run seed` works (README) | `package.json` `"seed": "tsx prisma/seed.ts"` + `prisma.seed` hook |

## Stack versions

| Claim (source) | Backed by |
|---|---|
| Next.js 16 (README badge, Stack, SPEC) | `package.json` `"next": "16.2.9"` |
| Prisma 7 (README, SPEC) | `package.json` `"@prisma/client": "^7.5.0"` |
| React 19.2.7 (SPEC) | `package.json` `"react": "19.2.7"` |

## Tests

| Claim (source) | Backed by |
|---|---|
| Unit tests for retriever + embed-writer (README, SPEC) | `tests/retriever.test.ts`, `tests/embed-writer.test.ts` |
| `detectAmenityCategories` tested against the real source (this PR) | `tests/retriever.test.ts` imports from `@/lib/rag/retriever` |
| `sources[]` shape + dedup tested (this PR) | `tests/sources.test.ts`, `tests/query-route.test.ts` |
| API query path tested for retrieve + refuse with mocked embeddings (this PR) | `tests/query-route.test.ts` |
