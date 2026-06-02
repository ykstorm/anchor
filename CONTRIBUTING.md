# Contributing to Anchor

Thank you for your interest in contributing!

## Quick start

```bash
git clone https://github.com/ykstorm/anchor.git
cd anchor
cp .env.example .env
# fill in OPENAI_API_KEY and DATABASE_URL
npm install
npx prisma migrate dev
docker compose up -d
curl -X POST http://localhost:3000/api/admin/seed   # seed demo corpus
npm run dev
```

## Repository structure

```
anchor/
├── src/
│   ├── app/api/            # API routes — add new endpoints here
│   └── lib/rag/            # Core retrieval and embed logic
│       ├── retriever.ts    # Retrieval pipeline (embed → pgvector → floor)
│       └── embed-writer.ts # Embed pipeline (chunk → upsert)
├── tests/                  # Vitest unit tests
├── scripts/                # Dev scripts (backfill, calibrate, e2e)
└── docs/architecture.md   # System design reference
```

## Development workflow

### Code changes

1. **New API route** → add to `src/app/api/<name>/route.ts`
2. **New RAG logic** → add to `src/lib/rag/`
3. **New script** → add to `scripts/`
4. Write or update tests in `tests/`

### Running tests

```bash
npm test              # run once with coverage
npm run test:watch   # watch mode for TDD
```

### Typecheck

```bash
npx tsc --noEmit
```

### Lint

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
# → {"ok":true,"db":"healthy","embedder":"healthy"}
```

## Key files for common changes

| Change | File(s) |
|--------|---------|
| Add embed function | `src/lib/rag/embed-writer.ts` |
| Change cosine floor | `src/lib/rag/retriever.ts` (`SIM_FLOOR_NORMAL`, `SIM_FLOOR_AMENITY`) |
| Add new entity type | `src/lib/rag/embed-writer.ts` + `prisma/schema.prisma` |
| Change chunk size | `src/lib/rag/embed-writer.ts` (`chunkFor*` functions) |
| Add API route | `src/app/api/<name>/route.ts` |

## Commit convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

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

- Bug reports: include `npm test` output, `npx tsc --noEmit` output, and the query that triggered the issue
- Feature requests: describe the problem you're solving, not just the solution
- Questions: check `docs/architecture.md` first

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.