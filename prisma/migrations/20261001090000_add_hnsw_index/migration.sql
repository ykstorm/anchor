-- Add the HNSW index that backs cosine similarity search on Embedding.embedding.
-- Previously claimed in docs but never created; this makes the claim true.
-- pgvector must be installed (see the init migration's CREATE EXTENSION vector).
CREATE INDEX IF NOT EXISTS "Embedding_embedding_hnsw_idx"
  ON "Embedding" USING hnsw (embedding vector_cosine_ops);
