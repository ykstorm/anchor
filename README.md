# RAG Starter — Next.js 15 + Prisma + pgvector

A production-ready RAG (Retrieval-Augmented Generation) template built with:

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Prisma 7** with **Neon serverless Postgres** + **pgvector**
- **OpenAI embeddings** (`text-embedding-3-small`)
- **Score floor**: 0.30 cosine similarity (configurable)

## Quick Start

```bash
# 1. Clone and install
npm install

# 2. Set up environment
cp .env.example .env
# Fill in DATABASE_URL and OPENAI_API_KEY

# 3. Apply migrations (requires pgvector extension on DB)
npx prisma migrate dev

# 4. Generate Prisma client
npx prisma generate

# 5. Run dev server
npm run dev
```

## Architecture

```
src/lib/rag/
  retriever.ts      # Vector search with OpenAI embeddings
  embed-writer.ts   # Chunking + embedding upsert
scripts/
  embed-backfill.ts # Bulk embed all records
```

### Retrieval Pipeline

`retrieveChunks(query, k=6)`:
1. Embed query with OpenAI `text-embedding-3-small`
2. pgvector `<=>` (cosine distance) search on `Embedding` table
3. Filter by similarity ≥ 0.30 (amenity queries: ≥ 0.20)
4. Amenity-category queries get adaptive K (10 vs 6) + location boost

### Embedding Pipeline

`embed-{entity}()` functions per entity type:
- `chunkForProject()` — price, possession, amenities, analyst notes
- `chunkForBuilder()` — trust scores, grade (sensitive fields excluded)
- `chunkForLocality()` — YoY growth, demand score, avg price/sqft
- `chunkForInfra()` — infrastructure items with price impact
- `chunkForLocationData()` — amenity POIs with category-first phrasing

### Score Floor

Cosine similarity floor is **0.30** by default. Configured in `retriever.ts`:
- Normal queries: `simFloor = 0.30`, `k = 6`
- Amenity queries: `simFloor = 0.20`, `k = 10` (higher recall)

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
OPENAI_API_KEY=sk-...
```

## Scripts

```bash
npm run embed:backfill      # Embed all existing records
npm run embed:backfill -- --dry  # Estimate tokens without embedding
```

## Tech Stack

- Next.js 15.2.9 + React 19.2.4
- Prisma 7 + `@prisma/adapter-neon`
- OpenAI 6.x (`text-embedding-3-small`)
- js-tiktoken for token counting
- Vercel AI SDK 6 (streaming ready)