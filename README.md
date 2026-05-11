# rag-starter

**Production-ready RAG template for Next.js 15 + Prisma + pgvector.**  
Retrieval-Augmented Generation pipeline with 0.30 cosine similarity score floor, adaptive K, and idempotent upsert. Extracted from Homesty.ai's buyerchat — deployed in production, handling real queries.

---

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Prisma 7** + **Neon serverless Postgres** + **pgvector**
- **OpenAI embeddings** (`text-embedding-3-small`)
- **Score floor**: 0.30 cosine similarity (configurable)

---

## Install

```bash
git clone https://github.com/ykstorm/rag-starter && cd rag-starter
npm install
cp .env.example .env
# Fill in DATABASE_URL and OPENAI_API_KEY
npx prisma migrate dev
npx prisma generate
npm run dev
```

---

## Architecture

```
src/lib/rag/
  retriever.ts      # Vector search with OpenAI embeddings
  embed-writer.ts   # Chunking + embedding upsert
scripts/
  embed-backfill.ts # Bulk embed all records
```

### Retrieval pipeline

`retrieveChunks(query, k=6)`:
1. Embed query with OpenAI `text-embedding-3-small`
2. pgvector `<=>` (cosine distance) search on `Embedding` table
3. Filter by similarity ≥ 0.30 (amenity queries: ≥ 0.20)
4. Amenity-category queries get adaptive K (10 vs 6) + location boost

### Embedding pipeline

`embed-{entity}()` functions per entity type:
- `chunkForProject()` — price, possession, amenities, analyst notes
- `chunkForBuilder()` — trust scores, grade (sensitive fields excluded)
- `chunkForLocality()` — YoY growth, demand score, avg price/sqft
- `chunkForInfra()` — infrastructure items with price impact
- `chunkForLocationData()` — amenity POIs with category-first phrasing

### Score floor

Cosine similarity floor is **0.30** by default:
- Normal queries: `simFloor = 0.30`, `k = 6`
- Amenity queries: `simFloor = 0.20`, `k = 10` (higher recall for amenity searches)

Configurable in `retriever.ts`.

---

## Environment variables

```env
DATABASE_URL=postgresql://user:***@host/db?sslmode=require
OPENAI_API_KEY=sk-...
```

---

## Scripts

```bash
npm run embed:backfill      # Embed all existing records
npm run embed:backfill -- --dry  # Estimate tokens without embedding
```

---

## License

Apache 2.0 — see [LICENSE](./LICENSE).