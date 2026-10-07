# Anchor

[![CI](https://github.com/ykstorm/anchor/actions/workflows/ci.yml/badge.svg)](https://github.com/ykstorm/anchor/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Retrieval for pgvector that returns no answer when the best match is too weak, and names the source of every chunk it returns.

## What it is

Anchor takes a text query and searches a Postgres table for the closest stored chunks. A chunk is a piece of source text stored with its embedding. An embedding is a list of numbers that represents the meaning of a text. pgvector is the Postgres extension that stores embeddings and searches them by distance.

Anchor embeds the query and ranks the chunks by cosine similarity. Cosine similarity is a score for how close two embeddings are in meaning. The higher it is, the closer they are.

When the best match clears a similarity floor, Anchor returns the matching chunks with their provenance. Provenance is a record of which source each chunk came from.

When nothing clears the floor, Anchor returns an empty result flagged `refused`. It also returns the floor and the best similarity it saw, so the caller can tell a real miss from a weak guess.

No LLM is called. This is the retrieval layer a model would sit on top of.

The approach was extracted from an earlier project, where answering a buyer's question with a confident guess was worse than saying the information was not in the sources.

- Live demo: [anchor-iota-ten.vercel.app](https://anchor-iota-ten.vercel.app)
- Playground: [anchor-iota-ten.vercel.app/playground](https://anchor-iota-ten.vercel.app/playground)

## The idea

Most RAG examples take the top-K chunks and hand them to the model regardless of how weak the match is. RAG (retrieval-augmented generation) means fetching relevant text first and giving it to a language model to answer from. Top-K means the K best-scoring chunks.

A cosine similarity of 0.12 between the query and the closest chunk is not a basis for an answer. A pipeline that keeps only the top K passes it on anyway. The model then produces a plausible, cited, wrong answer.

Anchor checks a similarity floor first. The floor is a minimum score. Below it, there is no answer to give.

The floor is a property of the corpus, not a universal constant. The default is `0.30`. It has not been calibrated against the seeded demo corpus or any other (see Not measured below). A different corpus will want a different number. Find it by comparing the similarity distributions of queries you know are answerable against ones you know are not.

## Architecture overview

```
Query → Embed → pgvector cosine similarity → {best score ≥ floor?} → Yes: chunks + sources / No: refused
```

- Cosine floor: a configurable threshold (default 0.30). Below it the result is empty and `refused` is true. The floor is never lowered by the query text.
- Adaptive K: precision queries use K=6. Amenity queries ask about nearby facilities, such as "schools near North Ridge". They widen to K=10 and boost on-topic location rows, but keep the same floor.
- Provenance: every chunk carries its `sourceId`. The response includes a de-duplicated `sources[]` array.
- Failure is not refusal: an embedding or database error returns 503, including a database error in the rate limiter, which runs first. It is never reported as an empty "no answer".

## Quickstart (clean machine, <5 min)

The only thing you bring is an `OPENAI_API_KEY`. Docker provides Postgres and pgvector, so no hosted database is required.

```bash
# 1. Clone
git clone https://github.com/ykstorm/anchor.git && cd anchor

# 2. Configure: open .env, paste your OPENAI_API_KEY, and set DATABASE_URL to
#    the local docker string documented in .env.example:
#    postgresql://anchor:anchor@localhost:5432/anchor?sslmode=disable
cp .env.example .env

# 3. Start Postgres + pgvector (creates the `vector` extension on first boot).
#    Name the service: a bare `docker compose up -d` also builds and starts the
#    app container on port 3000, the port `npm run dev` needs in step 7.
docker compose up -d postgres

# 4. Install deps
npm install

# 5. Provision the schema (applies prisma/migrations: tables, vector column, HNSW index)
npx prisma migrate deploy

# 6. Seed the corpus (60 rows) and embed it into pgvector
npm run seed

# 7. Run
npm run dev
```

Open http://localhost:3000/playground and try two queries:

- `Which Builder A projects in North Ridge are ready to move in?` is retrieved. You get chunks and `sources[]`.
- `xkcd 18472 nonsense gibberish` is refused. You get `refused: true`, empty `chunks` and empty `sources`.

`npm run seed` needs `OPENAI_API_KEY` to embed. Without a key it still seeds the structured rows and tells you to re-run once the key is set.

The seed replaces whatever corpus the database holds. After writing the demo rows it deletes every other row in the five corpus tables, and after embedding them it deletes every chunk it did not just write. Do not point it at a database whose corpus you want to keep.

## API

`POST /api/query` takes a JSON body `{"q": "..."}`. It returns `chunks`, `refused`, `sources`, `floor` and `maxSimilarity`.

Bad requests return 400, 415 or 403. Too many requests return 429. A retrieval failure returns 503. The full list is in [docs/architecture.md](docs/architecture.md).

These two calls run against the live demo:

```bash
# Refused state (off-topic for the seeded corpus)
curl -X POST https://anchor-iota-ten.vercel.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"q":"xkcd 18472 nonsense gibberish"}'
# response shape:
# {"chunks":[],"refused":true,"sources":[],"floor":0.3,"maxSimilarity":<best score, below 0.3>}

# Grounded state (matches the seeded demo corpus)
curl -X POST https://anchor-iota-ten.vercel.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"q":"Which Builder A projects in North Ridge are ready to move in?"}'
# response shape:
# {"chunks":[{"sourceType":"project","sourceId":"<id>","content":"Project: ...","similarity":<0.3 or more>}, ...],
#  "refused":false,
#  "sources":[{"sourceId":"<id>","sourceType":"project","similarity":<that source's best score>,"chunkCount":1}, ...],
#  "floor":0.3,"maxSimilarity":<best score>}
```

The examples show the shape, not captured values, because the scores depend on the corpus and the embedding model. `maxSimilarity` is the best score the search saw before the floor was applied, or `null` when the `Embedding` table is empty. `chunkCount` is always 1 with the current schema: `prisma/schema.prisma` allows one chunk per `(sourceType, sourceId)`, so each source in `sources[]` has exactly one chunk behind it.

The seeded corpus is a synthetic real-estate dataset of invented placeholders: 16 projects, 5 builders, 4 localities, 4 infra items, 31 points of interest (60 rows). On-topic queries about those entities retrieve. Anything else is refused.

## Performance

Retrieval is a pgvector HNSW cosine search over the `Embedding` table. HNSW (Hierarchical Navigable Small World) is an index that finds approximate nearest neighbours without scanning every row.

The numbers below were measured in CI (GitHub Actions `ubuntu-latest`, Node 20, `pgvector/pgvector:pg16` service) at three corpus sizes. The vectors have 1536 dimensions, the index uses `vector_cosine_ops`, k=6, and each size ran 300 queries.

| Vectors | p50 | p95 | p99 |
|---|---|---|---|
| 1,000 | 0.94 ms | 1.06 ms | 1.32 ms |
| 10,000 | 1.47 ms | 1.86 ms | 2.25 ms |
| 100,000 | 2.59 ms | 3.51 ms | 4.48 ms |

The p50, p95 and p99 columns are the times that 50%, 95% and 99% of queries stayed under.

These figures cover the DB-side vector search only (the query plus the round trip on the bench table), roughly 1 to 3 ms. They exclude the upstream embedding API call, which dominates end-to-end latency and is not benchmarked here.

The numbers come from [`.github/workflows/benchmark.yml`](.github/workflows/benchmark.yml). To reproduce them locally, run `node bench/latency-scale.mjs`. It needs Postgres and pgvector via Docker. It uses random vectors and no API key. See the script header.

### Not measured

The only latency numbers in this repo are the database-side benchmark above, and it runs on random vectors, not real embeddings. Its latest run, CI run 37188935917 on 2026-10-04, printed p95 3.45 ms at 100,000 vectors. The p95 of a whole `/api/query` request, which adds the OpenAI embedding call, the rate-limit writes and the network between the app and the database, has never been measured. The 0.30 floor has never been calibrated against a labelled set of answerable and unanswerable questions, so nothing in the repo measures how well it separates them.

## Stack

| Layer | Choice |
|---|---|
| Vector DB | Postgres + pgvector |
| ORM | Prisma 7 |
| API | Next.js 16 (App Router) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Deploy | Vercel |
| License | Apache 2.0 |

It is a small, single-service codebase with no framework beyond Next.js. It does depend on hosted services: every seeded row and every query not already in the in-memory cache calls the OpenAI embeddings API, and the live demo runs on Vercel with its Postgres on Neon. Locally, Docker replaces Vercel and Neon, but the OpenAI key is still needed. Exact versions are in [package.json](package.json).

## Project layout

```
anchor/
├── src/app/api/               # API routes (query, health, admin/seed)
├── src/app/playground/        # /playground: interactive query UI
├── src/components/ui/         # panel, button, field, status line and chunk list used by the playground
├── src/lib/rag/               # retriever, embed-writer, sources, sanitize, demo-seeder, seed-runner
├── src/lib/                   # prisma client, openai factory, rate limiter
├── prisma/                    # schema + migrations (incl. CREATE EXTENSION vector + HNSW index) + seed.ts
├── scripts/                   # embed-backfill
├── tests/                     # retriever, embed-writer, sources, sanitize, rate-limit, query-route, seed-replace, playground-query tests
├── docs/architecture.md       # system architecture and request flows
├── docs/CLAIM_AUDIT.md        # every public claim, mapped to the file:line that backs it
├── docker-compose.yml         # Postgres + pgvector + app
├── Dockerfile                 # multi-stage production image
└── SPEC.md                    # feature inventory + code locations
```

## Known limitations

- No LLM generation. Anchor is retrieval-only. Wire it to your model's system prompt yourself.
- Small demo corpus. It holds 16 projects of synthetic data, not 100k+ documents.
- Simple ranking. Results come back in cosine-similarity order. The only re-ranking is a fixed boost that moves matching location rows up for amenity queries (`rerankAmenity` in `src/lib/rag/retriever.ts`). There is no model-based re-ranking and no hybrid retrieval (BM25 keyword scoring combined with vector search).

## Security and credentials

Secrets live only in `.env`, which is gitignored. `.env.example` ships placeholders (`REPLACE_ME`) and the local docker default, nothing real. Connection strings in `docker-compose.yml`, CI, and the `Dockerfile` are throwaway local and CI values, overridable via environment variables.

If a credential is ever exposed (commit, log, screenshot, CI output), rotate it. Provision a replacement, update every environment, then revoke the old one. Full steps are in [SECURITY.md, Credential rotation](SECURITY.md#credential-rotation).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

Apache 2.0. See [LICENSE](LICENSE).
