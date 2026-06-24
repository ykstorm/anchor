// Retrieval-latency benchmark for the pgvector HNSW cosine search that backs
// Anchor's refusal floor. Measures the DB-side vector search (the same query
// shape as src/lib/rag/retriever.ts), excluding the upstream embedding API call
// — so it runs with random vectors and needs no OPENAI_API_KEY.
//
// Setup (Docker):
//   docker run -d --name anchor-pg -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=anchor \
//     -p 5440:5432 pgvector/pgvector:pg16
//   docker exec anchor-pg psql -U postgres -d anchor -c "
//     CREATE EXTENSION IF NOT EXISTS vector;
//     CREATE TABLE \"Embedding\" (id text PRIMARY KEY, \"sourceType\" text,
//       \"sourceId\" text, content text, embedding vector(1536));
//     INSERT INTO \"Embedding\" (id,\"sourceType\",\"sourceId\",content,embedding)
//     SELECT g::text,'project','p'||g,'chunk '||g,
//       (SELECT '['||string_agg((random())::text,',')||']'
//        FROM generate_series(1,1536))::vector
//     FROM generate_series(1,1000) g;
//     CREATE INDEX ON \"Embedding\" USING hnsw (embedding vector_cosine_ops);"
//
// Run:  npm i pg && node bench/retrieval.mjs
import pg from 'pg'

const ROWS = 1000, N = 300, K = 6
const c = new pg.Client({ host: 'localhost', port: 5440, user: 'postgres', password: 'pw', database: 'anchor' })
await c.connect()

// Same query as retrieveChunks(): cosine distance, ORDER BY <=> with the HNSW index.
const SQL = `SELECT "sourceType","sourceId","content", 1-(embedding <=> $1::vector) AS similarity
             FROM "Embedding" ORDER BY embedding <=> $1::vector LIMIT $2`
const randVec = () => '[' + Array.from({ length: 1536 }, () => Math.random().toFixed(6)).join(',') + ']'

for (let i = 0; i < 20; i++) await c.query(SQL, [randVec(), K]) // warm
const times = []
for (let i = 0; i < N; i++) {
  const v = randVec()
  const t0 = process.hrtime.bigint()
  await c.query(SQL, [v, K])
  times.push(Number(process.hrtime.bigint() - t0) / 1e6)
}
times.sort((a, b) => a - b)
const pct = (p) => times[Math.min(N - 1, Math.floor((N * p) / 100))]
console.log(`rows=${ROWS} queries=${N} k=${K} index=HNSW(cosine)`)
console.log(`p50=${pct(50).toFixed(2)}ms p95=${pct(95).toFixed(2)}ms p99=${pct(99).toFixed(2)}ms min=${times[0].toFixed(2)}ms`)
await c.end()
