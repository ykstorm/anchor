import { describe, it, expect } from 'vitest'
import { buildSources } from '@/lib/rag/sources'
import type { RetrievedChunk } from '@/lib/rag/retriever'

function chunk(p: Partial<RetrievedChunk>): RetrievedChunk {
  return {
    sourceType: p.sourceType ?? 'project',
    sourceId: p.sourceId ?? 'id-1',
    content: p.content ?? 'content',
    similarity: p.similarity ?? 0.5,
  }
}

describe('buildSources', () => {
  it('returns empty array for empty chunks (refused responses carry no sources)', () => {
    expect(buildSources([])).toEqual([])
  })

  it('produces one entry per distinct (sourceType, sourceId)', () => {
    const sources = buildSources([
      chunk({ sourceType: 'project', sourceId: 'a', similarity: 0.8 }),
      chunk({ sourceType: 'builder', sourceId: 'b', similarity: 0.7 }),
    ])
    expect(sources).toHaveLength(2)
    expect(sources.map((s) => `${s.sourceType}:${s.sourceId}`).sort()).toEqual([
      'builder:b',
      'project:a',
    ])
  })

  it('dedupes chunks from the same source and counts them', () => {
    const sources = buildSources([
      chunk({ sourceType: 'project', sourceId: 'a', similarity: 0.6 }),
      chunk({ sourceType: 'project', sourceId: 'a', similarity: 0.9 }),
      chunk({ sourceType: 'project', sourceId: 'a', similarity: 0.7 }),
    ])
    expect(sources).toHaveLength(1)
    expect(sources[0].chunkCount).toBe(3)
    // similarity is the MAX seen for that source
    expect(sources[0].similarity).toBe(0.9)
  })

  it('does not collide same sourceId across different sourceTypes', () => {
    const sources = buildSources([
      chunk({ sourceType: 'project', sourceId: 'x', similarity: 0.5 }),
      chunk({ sourceType: 'locality', sourceId: 'x', similarity: 0.5 }),
    ])
    expect(sources).toHaveLength(2)
  })

  it('sorts by similarity descending', () => {
    const sources = buildSources([
      chunk({ sourceId: 'low', similarity: 0.31 }),
      chunk({ sourceId: 'high', similarity: 0.92 }),
      chunk({ sourceId: 'mid', similarity: 0.55 }),
    ])
    expect(sources.map((s) => s.sourceId)).toEqual(['high', 'mid', 'low'])
  })

  it('coerces string similarities (pgvector returns numeric-as-string)', () => {
    const sources = buildSources([
      // similarity arrives as a string from raw SQL — must still be a number out
      { sourceType: 'project', sourceId: 'a', content: 'c', similarity: '0.81' as unknown as number },
    ])
    expect(sources[0].similarity).toBe(0.81)
    expect(typeof sources[0].similarity).toBe('number')
  })

  it('each entry exposes the advertised provenance shape', () => {
    const [s] = buildSources([chunk({ sourceType: 'builder', sourceId: 'goyal', similarity: 0.7 })])
    expect(s).toMatchObject({
      sourceId: 'goyal',
      sourceType: 'builder',
      similarity: 0.7,
      chunkCount: 1,
    })
    expect(Object.keys(s).sort()).toEqual(['chunkCount', 'similarity', 'sourceId', 'sourceType'])
  })
})
