import type { RetrievedChunk } from '@/lib/rag/retriever'

/**
 * Structured provenance entry attached to every grounded /api/query and
 * /api/chat response. One entry per distinct (sourceType, sourceId) pair —
 * deduped across the returned chunks so a single source that produced multiple
 * chunks is reported once.
 */
export type Source = {
  /** Stable identifier of the underlying record (Embedding.sourceId). */
  sourceId: string
  /** Entity family: 'project' | 'builder' | 'locality' | 'infra' | 'location_data'. */
  sourceType: string
  /** Best (highest) cosine similarity among the chunks from this source. */
  similarity: number
  /** Number of retrieved chunks that resolved to this source. */
  chunkCount: number
}

/**
 * Build a deduped, provenance `sources[]` array from retrieved chunks.
 *
 * - Deduped by `${sourceType}:${sourceId}` — the headline differentiator is a
 *   clean provenance list, not one entry per chunk.
 * - `similarity` is the max similarity seen for that source (most relevant hit).
 * - `chunkCount` tells the caller how many chunks backed this source.
 * - Sorted by similarity descending so the strongest provenance leads.
 * - An empty `chunks` input yields an empty array (refused responses carry no sources).
 *
 * Pure function — no DB, no network — so it is fully unit-testable.
 */
export function buildSources(chunks: RetrievedChunk[]): Source[] {
  const byKey = new Map<string, Source>()

  for (const c of chunks) {
    const similarity = Number(c.similarity)
    const key = `${c.sourceType}:${c.sourceId}`
    const existing = byKey.get(key)
    if (existing) {
      existing.chunkCount += 1
      if (similarity > existing.similarity) existing.similarity = similarity
    } else {
      byKey.set(key, {
        sourceId: c.sourceId,
        sourceType: c.sourceType,
        similarity,
        chunkCount: 1,
      })
    }
  }

  return Array.from(byKey.values()).sort((a, b) => b.similarity - a.similarity)
}
