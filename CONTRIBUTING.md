# Contributing to Anchor

Thank you for your interest in contributing.

## Quick start

```bash
git clone https://github.com/ykstorm/anchor.git
cd anchor
cp .env.example .env
# fill in OPENAI_API_KEY and DATABASE_URL
npm install
npx prisma migrate dev
docker compose up -d
curl -X POST http://localhost:3000/api/admin/seed -H "x-seed-token: $SEED_TOKEN"   # seed demo corpus
npm run dev
```

## Repository structure

```
anchor/
├── src/
│   ├── app/api/            # API routes: add new endpoints here
│   └── lib/rag/            # Core retrieval and embed logic
│       ├── retriever.ts    # Retrieval pipeline (embed → pgvector → floor)
│       └── embed-writer.ts # Embed pipeline (chunk → upsert)
├── tests/                  # Vitest unit tests
├── scripts/                # Dev scripts (embed-backfill)
└── docs/architecture.md   # System design reference
```

The retrieval pipeline embeds the query, which turns it into an embedding, a list of numbers that represents its meaning. It then searches pgvector, the Postgres extension that stores embeddings and searches them by distance. Results below the cosine floor, the minimum similarity score a chunk needs, are dropped. The embed pipeline splits source data into chunks, embeds each chunk and upserts it. An upsert inserts a row, or updates it if it already exists.

## Development workflow

### Code changes

1. For a new API route, add `src/app/api/<name>/route.ts`.
2. For new retrieval or embedding logic, add it to `src/lib/rag/`.
3. For a new script, add it to `scripts/`.
4. Write or update tests in `tests/`.

### Running tests

```bash
npm test              # run once with coverage
npm run test:watch   # watch mode for TDD
```

### Typecheck

This checks the TypeScript types without writing any output files.

```bash
npx tsc --noEmit
```

### Lint

Lint runs ESLint, which flags style problems and likely bugs.

```bash
npm run lint
```

### Docker local stack

```bash
docker compose up -d        # start Postgres + app
docker compose logs -f app  # follow app logs
docker compose down        # stop
docker compose down -v     # stop + wipe data
```

### Health check

```bash
curl http://localhost:3000/api/health
# → {"ok":true,"db":true}
```

## Key files for common changes

| Change | File(s) |
|--------|---------|
| Add embed function | `src/lib/rag/embed-writer.ts` |
| Change cosine floor | `src/lib/rag/retriever.ts` (`SIM_FLOOR`) |
| Add new entity type | `src/lib/rag/embed-writer.ts` + `prisma/schema.prisma` |
| Change chunk size | `src/lib/rag/embed-writer.ts` (`chunkFor*` functions) |
| Add API route | `src/app/api/<name>/route.ts` |

## Commit convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Each commit message starts with a type such as `feat` or `fix`, then a colon and a short description.

```
feat: add cosine floor metric to health endpoint
fix: handle null prices in chunkForProject
docs: update architecture diagram for write path
test: add tests for adaptive K on amenity queries
refactor: extract embedder into separate module
```

## Pull request checklist

- [ ] `npm test` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] New features have unit tests
- [ ] `SPEC.md` updated if behavior changed
- [ ] `CHANGELOG.md` entry added under `[Unreleased]`

## Opening an issue

- For a bug report, include the `npm test` output, the `npx tsc --noEmit` output, and the query that triggered the issue.
- For a feature request, describe the problem you are solving, not just the solution.
- For a question, check `docs/architecture.md` first.

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
