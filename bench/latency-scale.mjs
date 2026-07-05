// Retrieval-latency-at-scale benchmark for Anchor's pgvector HNSW cosine search.
// Measures the DB-side vector search (same query shape as src/lib/rag/retriever.ts)
// at 1k / 10k / 100k vectors. Random vectors — no OPENAI_API_KEY, no cost. This
// measures search latency, not recall (recall needs a labelled corpus + real
// embeddings; out of scope here).
//
// Setup (Docker):
//   docker run -d --name anchor-pg -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=anchor \
//     -p 5440:5432 pgvector/pgvector:pg16
//
// Run:  npm i pg && node bench/latency-scale.mjs
import pg from 'pg'

const SCALES = [1000, 10000, 100000]
const N_QUERIES = 300, K = 6, DIM = 1536
const c = new pg.Client({ host: 'localhost', port: 5440, user: 'postgres', password: 'pw', database: 'anchor' })
await c.connect()
await c.query('CREATE EXTENSION IF NOT EXISTS vector')
await c.query('DROP TABLE IF EXISTS "Embedding"')
await c.query(`CREATE TABLE "Embedding" (id text PRIMARY KEY, "sourceType" text, "sourceId" text, content text, embedding vector(${DIM}))`)

const SQL = `SELECT "sourceType","sourceId","content", 1-(embedding <=> $1::vector) AS similarity
             FROM "Embedding" ORDER BY embedding <=> $1::vector LIMIT $2`
const randVec = () => '[' + Array.from({ length: DIM }, () => Math.random().toFixed(6)).join(',') + ']'

const results = []
let have = 0
for (const N of SCALES) {
  // top up to N rows (cumulative), then rebuild the HNSW index
  const add = N - have
  process.stderr.write(`seeding ${add} rows -> ${N}...\n`)
  // Generate vectors in Node (fast) and bulk-insert in batches — far faster
  // than 100k*1536 SQL random() calls.
  const BATCH = 500
  for (let start = have + 1; start <= N; start += BATCH) {
    const endB = Math.min(N, start + BATCH - 1)
    const rows = [], params = []
    let p = 1
    for (let g = start; g <= endB; g++) {
      rows.push(`($${p++},$${p++},$${p++},$${p++},$${p++}::vector)`)
      params.push(String(g), 'project', 'p' + g, 'chunk ' + g, randVec())
    }
    await c.query(`INSERT INTO "Embedding" (id,"sourceType","sourceId",content,embedding) VALUES ${rows.join(',')}`, params)
  }
  have = N
  await c.query('DROP INDEX IF EXISTS emb_hnsw')
  process.stderr.write(`building HNSW index @ ${N}...\n`)
  await c.query('CREATE INDEX emb_hnsw ON "Embedding" USING hnsw (embedding vector_cosine_ops)')

  for (let i = 0; i < 20; i++) await c.query(SQL, [randVec(), K]) // warm
  const t = []
  for (let i = 0; i < N_QUERIES; i++) {
    const v = randVec(); const t0 = process.hrtime.bigint()
    await c.query(SQL, [v, K]); t.push(Number(process.hrtime.bigint() - t0) / 1e6)
  }
  t.sort((a, b) => a - b)
  const pct = (p) => t[Math.min(N_QUERIES - 1, Math.floor((N_QUERIES * p) / 100))]
  const row = { vectors: N, p50: +pct(50).toFixed(2), p95: +pct(95).toFixed(2), p99: +pct(99).toFixed(2) }
  results.push(row)
  console.log(`vectors=${N} p50=${row.p50}ms p95=${row.p95}ms p99=${row.p99}ms`)
}
await c.end()
console.log('\nJSON:', JSON.stringify({ k: K, queries: N_QUERIES, index: 'hnsw(cosine)', node: process.version, results }))
