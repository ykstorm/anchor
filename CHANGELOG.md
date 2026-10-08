# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

These changes are on main since 0.1.0.

### Added
- Plain UI components under `src/components/ui` (Panel, Button, Textarea, Field, StatusLine, EmptyState, ChunkList) and the design tokens in `src/app/globals.css`, shared with the portfolio site (#49).
- A `not-found` page on the same tokens (#50).
- `GET /api/health`. It runs `SELECT 1` against the database and returns `{"ok":true,"db":true}`, or 503 with `{"ok":false,"db":false}` when the query fails.
- A `sources[]` array on `/api/query` responses. It lists each source once, with `sourceId`, `sourceType`, `similarity` and `chunkCount`.
- `floor` and `maxSimilarity` on `/api/query` responses, so a refusal can be explained.
- A homepage and a `/playground` page that run queries against the seeded demo corpus.
- `npm run seed`, which loads the 60-row demo corpus and embeds it.
- An initial migration that creates the `vector` extension and the tables, a migration that adds an HNSW index on `Embedding.embedding` (`vector_cosine_ops`), and a migration that adds the `RateLimit` table. HNSW is an index for fast approximate nearest-neighbour search. The index had been documented but never created.
- Rate limiting on `/api/query`: 20 requests per minute per caller and 1000 per hour overall. Callers are keyed by a hash, so no raw IP is stored. Over-limit requests get 429 with `Retry-After`. `/api/admin/seed` is limited to 3 requests per hour.
- Request checks on `/api/query`: 415 for a non-JSON body, 403 for a foreign Origin, and 400 for invalid JSON or a bad request body.
- Text cleanup in `src/lib/rag/sanitize.ts`. It removes control and zero-width characters, collapses whitespace and caps text at 2000 characters.
- A multi-stage `Dockerfile`, a `.dockerignore`, and a `docker-compose.yml` with `pgvector/pgvector:pg16`, the app and an optional pgAdmin.
- CI jobs for lint and tests, a Docker build, and a compose smoke test, plus an image push to `ghcr.io` on `v*` tags.
- A latency benchmark, `bench/latency-scale.mjs`, and a CI workflow for it, `.github/workflows/benchmark.yml`.
- Vercel Analytics and Speed Insights, and the security headers Content-Security-Policy, Strict-Transport-Security, X-Frame-Options and X-Content-Type-Options.
- Docs and project files: `CONTRIBUTING.md`, `SECURITY.md` with credential handling and rotation steps, `CODE_OF_CONDUCT.md`, `DEPLOY.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `SPEC.md`, `docs/architecture.md`, `docs/CLAIM_AUDIT.md`, issue and pull request templates, and a Dependabot config.

### Changed
- The project was renamed from rag-starter to Anchor, and the package is now `@ykstorm/anchor`.
- The license changed from MIT to Apache 2.0.
- The cosine floor is the exported constant `SIM_FLOOR` (0.30) and applies to every query. Amenity queries still widen K to 10 and boost location rows, but cannot lower the floor.
- A retrieval failure, meaning an embedding error, a database error or a database timeout, now raises `RetrievalError`. `/api/query` returns 503 instead of an empty result.
- Raw SQL uses a tagged `$queryRaw` template instead of `$queryRawUnsafe`, and ESLint now bans the `*RawUnsafe` helpers.
- There is one OpenAI client factory, with an 8000 ms timeout and one retry.
- Prisma uses the Neon HTTP adapter for Neon URLs and the node-postgres adapter for everything else, so a local Docker Postgres works.
- The seed route compares its token in constant time and returns no stack trace.
- `.env.example` uses `REPLACE_ME` placeholders. `docker-compose.yml` reads the Postgres and pgAdmin credentials from environment variables with local defaults. `.gitignore` covers `.env.*` except `.env.example`.
- `.env.example` no longer lists `DIRECT_URL` and `NEXT_PUBLIC_DEMO_MODE`, which nothing reads, and now lists `SEED_TOKEN`, which the seed route requires.
- Next.js was upgraded to 16.3.x, and `npm audit fix` was applied.
- Unit tests grew from 15 to 54.
- The README, `ARCHITECTURE.md`, `SPEC.md`, the design docs, `DEPLOY.md`, `SECURITY.md`, `ROADMAP.md`, `CHANGELOG.md` and `CONTRIBUTING.md` were rewritten in plain English.

### Fixed
- The rate limiter took the left-most `X-Forwarded-For` entry as the caller, which is the one a caller writes, so adding a fake address to the header gave a fresh bucket on every request. It now counts from the right: `TRUST_PROXY_HOPS` is the number of proxies in front of the app (default 1, which is right for Vercel), and the caller is that many entries from the right. A missing or malformed header, or a bad entry, now shares one bucket instead of falling back to a forgeable value. `X-Real-IP` is no longer read.
- The seed route checked its token before the rate limit, so wrong tokens could be tried without limit. It now counts every attempt first, so a caller's guesses end in 429 after 3 an hour. With no `SEED_TOKEN` set it still answers 401 without touching the database.
- The seed only upserted, so rows and chunks from an older corpus stayed in the database and kept being served. A seed run now replaces the corpus: it deletes corpus rows outside the demo set and chunks it did not write, each in one statement, and logs the counts.
- A database error in the rate limiter made `/api/query` answer 500. The route now catches it and answers the documented 503, logging `[query] retrieval failed: rate limit check failed`, before any embedding call.
- The CI workflow now also runs on `v*` tag pushes, so the image publish job can run.
- `ARCHITECTURE.md` said amenity queries use a 0.20 floor. It now says the floor stays 0.30 and only K changes.

### Removed
- The unused `/api/chat` route.

## [0.1.0] - 2026-05-11

### Added
- Vitest unit tests, 15 passing: 10 for the retriever and 5 for the embed-writer. Vitest is a test runner for TypeScript.
- GitHub Actions CI with a test job and a build job
- `npm test` and `npm run test:watch` scripts
- `vitest.config.ts` with the React plugin

### Changed
- `detectAmenityCategories` cross-population between ATM and bank verified working. A query that names one also searches for the other.
- `chunkForProject` handles zero prices and null configs.
