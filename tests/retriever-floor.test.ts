import { describe, it, expect, vi } from 'vitest'

// Mocks so the real retriever module can be imported and exercised end to end
// without a DB or an API key.
const { embeddingsCreate, queryRaw } = vi.hoisted(() => ({
  embeddingsCreate: vi.fn(async () => ({ data: [{ embedding: new Array(1536).fill(0.01) }] })),
  queryRaw: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}))

vi.mock('openai', () => ({
  default: class {
    embeddings = { create: embeddingsCreate }
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: queryRaw } }))

import { retrieveChunks, SIM_FLOOR, RetrievalError } from '@/lib/rag/retriever'

describe('retrieveChunks — floor cannot be lowered by query text', () => {
  it('amenity query ("park") whose best match is 0.25 is refused (floor stays 0.30)', async () => {
    queryRaw.mockResolvedValueOnce([
      { sourceType: 'location_data', sourceId: 'p1', content: 'park in North: Central Park.', similarity: 0.25 },
      { sourceType: 'location_data', sourceId: 'p2', content: 'park in North: River Park.', similarity: 0.22 },
    ])
    const res = await retrieveChunks('a flat near a park')
    expect(SIM_FLOOR).toBe(0.30)
    expect(res.chunks).toEqual([])
    expect(res.floor).toBe(0.30)
    expect(res.maxSimilarity).toBe(0.25)
  })

  it('amenity query above the floor still retrieves (and boosts location_data)', async () => {
    queryRaw.mockResolvedValueOnce([
      { sourceType: 'project', sourceId: 'proj', content: 'Project near parks', similarity: 0.40 },
      { sourceType: 'location_data', sourceId: 'p1', content: 'park in North: Central Park.', similarity: 0.35 },
    ])
    const res = await retrieveChunks('a flat near a park')
    expect(res.chunks.length).toBe(2)
    // location_data row naming the category is boosted above the raw 0.40 project
    expect(res.chunks[0].sourceType).toBe('location_data')
  })

  it('throws RetrievalError when the embedding call fails (failure is not refusal)', async () => {
    embeddingsCreate.mockRejectedValueOnce(new Error('openai down'))
    await expect(retrieveChunks('anything')).rejects.toBeInstanceOf(RetrievalError)
  })

  it('throws RetrievalError when the DB query fails', async () => {
    queryRaw.mockRejectedValueOnce(new Error('db down'))
    await expect(retrieveChunks('anything')).rejects.toBeInstanceOf(RetrievalError)
  })
})
