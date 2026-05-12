# rag-starter — RAG Template for Next.js + pgvector

[![CI](https://github.com/ykstorm/rag-starter/actions/workflows/ci.yml/badge.svg)](https://github.com/ykstorm/rag-starter/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

---

## Why I built this

I needed RAG in buyerchat — the AI chat needed to know real project prices, possession dates, amenities, and builder trust scores. Plain GPT-4o hallucinated. I needed the model to ground its answers in actual data.

The obvious approach: embed everything, retrieve relevant chunks at query time, inject into the system prompt as context. The tricky part was doing it without bloating latency. A naive implementation could add 500ms+ to every response. I wanted sub-50ms retrieval.

rag-starter is the extraction of that pipeline. Clean, documented, reusable.

---

## Quick start

```bash
git clone https://github.com/ykstorm/rag-starter && cd rag-starter
npm install
cp .env.example .env
# Fill in DATABASE_URL and OPENAI_API_KEY
npx prisma migrate dev
npx prisma generate
npm run dev

# Backfill existing records
npm run embed:backfill
```

---

## What it does

### Retrieval (`retrieveChunks`)

Embeds the user query with `text-embedding-3-small`, searches pgvector cosine distance, filters by 0.30 score floor. Returns top-K chunks (K=6 for normal queries, K=10 for amenity queries).

The adaptive K was a production decision — amenity queries like "nearest schools" need higher recall than project queries like "2BHK under 60 lakh in Bopal". Different information needs, different retrieval parameters.

If retrieval fails (timeout, embedding error, DB error), it returns an empty array. The chat pipeline renders PART 17 (context) only when chunks exist.

### Embedding (`embed-{entity}()`)

Chunk functions format entity data into text suitable for embedding:
- `chunkForProject()` — price range in Cr, possession date, amenities, analyst notes, honest concerns
- `chunkForBuilder()` — trust scores, grade (sensitive fields like contact info excluded)
- `chunkForLocality()` — YoY growth, demand score, avg price/sqft
- `chunkForInfra()` — infrastructure items with price impact
- `chunkForLocationData()` — amenity POIs with category-first phrasing

The backfill script runs all entities through their embed functions and upserts to the `Embedding` table.

---

## Architecture

```mermaid
graph LR
    A[User Query] --> B[Embed\ntext-embedding-3-small]
    B --> C[pgvector\n<=> cosine distance]
    C --> D{Score ≥ 0.30?}
    D -->|yes| E[Return top K chunks]
    D -->|no| F[Discard]
    E --> G[PART 17 in\nsystem prompt]
    F --> G

    subgraph "Write path"
    H[Entity data] --> I[chunkForProject\nchunkForBuilder\n...]
    I --> J[Embed\ntext-embedding-3-small]
    J --> K[Prisma upsert\nEmbedding table]
    end
```

**Score floor logic** (from `retriever.ts`):
- Normal queries: `simFloor = 0.30`, `k = 6`
- Amenity queries: `simFloor = 0.20`, `k = 10` (lower threshold, higher K for recall)

---

## The tricky part — score floor calibration

The 0.30 cosine floor wasn't arrived at by guesswork. I ran retrieval on production query logs and looked at what came back below 0.30 — most of it was noise (unrelated localities, outdated prices, wrong configurations). The threshold was set high enough to filter that out.

The amenity exception (0.20) was harder. "Schools near Bopal" retrieves items with "school" in the text but different similarity scores. A 0.20 threshold catches the borderline cases. The tradeoff is more noise — but for amenities, recall matters more than precision. A buyer can filter out a irrelevant result; they can't ask about something the model doesn't know exists.

---

## Tests

```bash
npm test           # 15 tests: embed-writer (5), retriever (10)
npm run embed:backfill        # Embed all records
npm run embed:backfill -- --dry  # Token estimate without writing
```

CI runs: `npm run build` → `npm test` → embed-test (embed-writer only).

---

## Environment variables

```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require  # Neon Postgres
OPENAI_API_KEY=sk-...                                          # OpenAI key
```

`DIRECT_URL` is optional — needed only for migrations. Runtime uses the pooled connection via `@prisma/adapter-neon`.

---

## What this project proves

For a fresher/junior full-stack role, this shows I can:

- Build RAG pipelines from scratch (not just copy a tutorial)
- Work with pgvector and understand cosine similarity vs other distance metrics
- Tune retrieval parameters (score floor, K) based on production data patterns
- Write idempotent data pipelines (upsert, not insert)
- Handle failure gracefully (empty array on retrieval failure, not crash)

---

## License

Apache 2.0 — see [LICENSE](LICENSE)