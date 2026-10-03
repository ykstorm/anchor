# Roadmap

## v0.1 — Current
- [x] Cosine floor (0.30, uniform)
- [x] Adaptive K (6 normal, 10 amenity)
- [x] Idempotent upsert by (entityType, entityId)
- [x] pgvector retrieval pipeline
- [x] 50 unit tests
- [x] Docker Compose (Postgres + pgvector + app)
- [ ] Multi-tenancy — not implemented; the schema is single-tenant

## v1.1 — Observability
- [ ] Query latency histogram in response headers
- [ ] Refusal rate metric (`refused: true` ratio per day)
- [ ] `/api/metrics` endpoint for Prometheus scraping

## v1.2 — Calibrate tool
- [ ] `npm run calibrate` — takes a CSV of (query, expected_refused) and sweeps the floor, outputs a recommended threshold
- [ ] Export calibration results to JSON for CI regression gates

## v2.0 — Hybrid search
- [ ] BM25 fallback for keyword queries (pgvector supports combined vector + text search)
- [ ] RRF (Reciprocal Rank Fusion) for combining vector + BM25 scores

## Not planned (open issue first)
- LLM generation — retrieval-only by design; generation is the caller's concern
- Multi-modal embeddings (images, PDFs)
- Elasticsearch swap
- Non-pgvector vector stores (Pinecone, Weaviate, Qdrant)