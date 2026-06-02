# Roadmap

## v1.0 — Current: Provenance-first RAG
- [x] Cosine floor (0.30 normal, 0.20 amenity)
- [x] Adaptive K (6 normal, 10 amenity)
- [x] Idempotent upsert by (entityType, entityId)
- [x] pgvector retrieval pipeline
- [x] 15 unit tests (retriever: 10, embed-writer: 5)
- [x] Docker Compose (Postgres + pgvector + app)
- [x] Multi-tenancy via `sourceType` + `sourceId` keys

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