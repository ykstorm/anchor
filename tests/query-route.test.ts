import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks must be defined via vi.hoisted so they exist when vi.mock factories run.
const { embeddingsCreate, queryRawUnsafe } = vi.hoisted(() => {
  return {
    // Deterministic OpenAI embedding (no API key needed)
    embeddingsCreate: vi.fn(async () => ({
      data: [{ embedding: new Array(1536).fill(0.01) }],
    })),
    // Deterministic vector search keyed off a global topic flag:
    //   on-topic  → high-similarity rows from two distinct sources (one source
    //               appears twice, to prove dedup)
    //   off-topic → only rows below the 0.30 floor
    queryRawUnsafe: vi.fn(async (_sql: string, _vec: string, _k: number) => {
      if ((globalThis as Record<string, unknown>).__topic === 'on') {
        return [
          { sourceType: 'project', sourceId: 'riviera-elite', content: 'Project: Riviera Elite …', similarity: 0.84 },
          { sourceType: 'project', sourceId: 'riviera-elite', content: 'Project: Riviera Elite (more) …', similarity: 0.71 },
          { sourceType: 'builder', sourceId: 'Goyal & Co. / HN Safal', content: 'Builder: Goyal …', similarity: 0.66 },
        ]
      }
      return [{ sourceType: 'project', sourceId: 'x', content: 'unrelated', similarity: 0.04 }]
    }),
  }
})

vi.mock('openai', () => ({
  default: class {
    embeddings = { create: embeddingsCreate }
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRawUnsafe: queryRawUnsafe } }))

import { POST } from '@/app/api/query/route'

function makeReq(q: string) {
  return new Request('http://localhost/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q }),
    // NextRequest accepts a standard Request
  }) as unknown as Parameters<typeof POST>[0]
}

beforeEach(() => {
  embeddingsCreate.mockClear()
  queryRawUnsafe.mockClear()
})

describe('POST /api/query', () => {
  it('high-similarity prompt → chunks + populated, deduped sources[]', async () => {
    ;(globalThis as Record<string, unknown>).__topic = 'on'
    const res = await POST(makeReq('Tell me about Riviera Elite by Goyal in Shela'))
    const body = await res.json()

    expect(body.refused).toBe(false)
    expect(body.chunks.length).toBe(3)

    // sources[] exists, is populated, and is DEDUPED (2 distinct sources, not 3)
    expect(Array.isArray(body.sources)).toBe(true)
    expect(body.sources).toHaveLength(2)

    const elite = body.sources.find((s: { sourceId: string }) => s.sourceId === 'riviera-elite')
    expect(elite).toBeDefined()
    expect(elite.sourceType).toBe('project')
    expect(elite.chunkCount).toBe(2) // two chunks collapsed into one source
    expect(elite.similarity).toBe(0.84) // best similarity retained

    // sorted by similarity desc → the project (0.84) leads the builder (0.66)
    expect(body.sources[0].sourceId).toBe('riviera-elite')
  })

  it('low-similarity prompt → refused:true, empty chunks, empty sources', async () => {
    ;(globalThis as Record<string, unknown>).__topic = 'off'
    const res = await POST(makeReq('quantum chromodynamics lattice gauge xkcd gibberish'))
    const body = await res.json()

    expect(body.refused).toBe(true)
    expect(body.chunks).toEqual([])
    expect(body.sources).toEqual([])
  })

  it('rejects malformed body with 400', async () => {
    const res = await POST(makeReq(''))
    expect(res.status).toBe(400)
  })
})
