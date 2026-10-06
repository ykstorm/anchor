# Roadmap

## v0.1: Current

- [x] Cosine floor, 0.30 for every query. Cosine similarity is a score for how close two embeddings are in meaning. The floor is the minimum score a chunk needs to be returned.
- [x] Adaptive K. K is the number of chunks fetched: 6 normally, and 10 for amenity queries (questions about nearby facilities).
- [x] Idempotent upsert by (sourceType, sourceId). An upsert inserts a row, or updates it if it already exists. Idempotent means doing it twice gives the same result.
- [x] pgvector retrieval pipeline. pgvector is the Postgres extension that stores embeddings and searches them by distance.
- [x] 50 unit tests
- [x] Docker Compose (Postgres + pgvector + app)
- [ ] Multi-tenancy, which means one deployment serving several customers with their data kept apart. It is not implemented. The schema is single-tenant.

## v1.1: Observability

Observability means being able to see how the service behaves from its metrics.

- [ ] Query latency histogram in response headers. A histogram counts queries in buckets by how long they took.
- [ ] Refusal rate metric (`refused: true` ratio per day)
- [ ] `/api/metrics` endpoint for Prometheus scraping. Prometheus is a monitoring tool that collects metrics by calling an endpoint.

## v1.2: Calibrate tool

- [ ] `npm run calibrate` takes a CSV of (query, expected_refused) rows. It sweeps the floor, which means trying a range of values, and outputs a recommended threshold.
- [ ] Export calibration results to JSON for CI regression gates. A regression gate is a CI check that fails when a result gets worse.

## v2.0: Hybrid search

- [ ] BM25 fallback for keyword queries. BM25 is a keyword scoring method. pgvector supports combining vector search with text search.
- [ ] RRF (Reciprocal Rank Fusion) for combining the vector and BM25 scores. RRF is a method for merging two ranked result lists.

## Not planned (open issue first)

- LLM generation. Anchor is retrieval-only by design, and generation is the caller's concern.
- Multi-modal embeddings (images, PDFs)
- Swapping pgvector for Elasticsearch
- Non-pgvector vector stores (Pinecone, Weaviate, Qdrant)
