import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks must be defined via vi.hoisted so they exist when vi.mock factories run.
const { embeddingsCreate, queryRaw, enforceQueryRateLimit } = vi.hoisted(() => {
  return {
    // Deterministic OpenAI embedding (no API key needed)
    embeddingsCreate: vi.fn(async () => ({
      data: [{ embedding: new Array(1536).fill(0.01) }],
    })),
    // Deterministic vector search keyed off a global topic flag:
    //   on-topic  → rows above the floor from two distinct sources (one source
    //               appears twice, to prove dedup)
    //   off-topic → only rows below the 0.30 floor
    queryRaw: vi.fn(async () => {
      if ((globalThis as Record<string, unknown>).__topic === 'on') {
        return [
          { sourceType: 'project', sourceId: 'north-court', content: 'Project: North Court …', similarity: 0.84 },
          { sourceType: 'project', sourceId: 'north-court', content: 'Project: North Court (more) …', similarity: 0.71 },
          { sourceType: 'builder', sourceId: 'Builder A', content: 'Builder: Builder A …', similarity: 0.66 },
        ]
      }
      return [{ sourceType: 'project', sourceId: 'x', content: 'unrelated', similarity: 0.04 }]
    }),
    enforceQueryRateLimit: vi.fn(async () => ({ ok: true, retryAfter: 0 })),
  }
})

vi.mock('openai', () => ({
  default: class {
    embeddings = { create: embeddingsCreate }
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: queryRaw } }))
vi.mock('@/lib/rate-limit', () => ({ enforceQueryRateLimit }))

import { POST } from '@/app/api/query/route'

function makeReq(
  q: unknown,
  opts: { raw?: string; contentType?: string; origin?: string; host?: string } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': opts.contentType ?? 'application/json',
  }
  if (opts.origin) headers['Origin'] = opts.origin
  if (opts.host) headers['Host'] = opts.host
  const body = opts.raw ?? JSON.stringify({ q })
  return new Request('http://localhost/api/query', {
    method: 'POST',
    headers,
    body,
  }) as unknown as Parameters<typeof POST>[0]
}

beforeEach(() => {
  embeddingsCreate.mockClear()
  queryRaw.mockClear()
  enforceQueryRateLimit.mockClear()
  enforceQueryRateLimit.mockResolvedValue({ ok: true, retryAfter: 0 })
})

describe('POST /api/query', () => {
  it('on-topic → chunks, deduped sources[], and floor echoed', async () => {
    ;(globalThis as Record<string, unknown>).__topic = 'on'
    const res = await POST(makeReq('Tell me about North Court by Builder A'))
    const body = await res.json()

    expect(body.refused).toBe(false)
    expect(body.chunks.length).toBe(3)
    expect(body.floor).toBe(0.3)
    expect(body.maxSimilarity).toBe(0.84)

    // sources[] is populated and DEDUPED (2 distinct sources, not 3)
    expect(Array.isArray(body.sources)).toBe(true)
    expect(body.sources).toHaveLength(2)

    const court = body.sources.find((s: { sourceId: string }) => s.sourceId === 'north-court')
    expect(court.chunkCount).toBe(2)
    expect(court.similarity).toBe(0.84)
    expect(body.sources[0].sourceId).toBe('north-court')

    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('off-topic → refused, empty chunks/sources, floor + best similarity reported', async () => {
    ;(globalThis as Record<string, unknown>).__topic = 'off'
    const res = await POST(makeReq('quantum chromodynamics lattice gauge gibberish'))
    const body = await res.json()

    expect(body.refused).toBe(true)
    expect(body.chunks).toEqual([])
    expect(body.sources).toEqual([])
    expect(body.floor).toBe(0.3)
    expect(body.maxSimilarity).toBe(0.04)
  })

  it('rejects malformed body with 400', async () => {
    const res = await POST(makeReq(''))
    expect(res.status).toBe(400)
  })

  it('rejects invalid JSON with 400', async () => {
    const res = await POST(makeReq(undefined, { raw: '{not json' }))
    expect(res.status).toBe(400)
  })

  it('rejects non-JSON content type with 415', async () => {
    const res = await POST(makeReq('hi', { contentType: 'text/plain' }))
    expect(res.status).toBe(415)
  })

  it('rejects a foreign Origin with 403', async () => {
    ;(globalThis as Record<string, unknown>).__topic = 'on'
    const res = await POST(
      makeReq('North Court', { origin: 'https://evil.example', host: 'localhost' })
    )
    expect(res.status).toBe(403)
  })

  it('returns 429 with Retry-After when rate limited', async () => {
    enforceQueryRateLimit.mockResolvedValueOnce({ ok: false, retryAfter: 42 })
    const res = await POST(makeReq('North Court'))
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('42')
  })

  it('returns 503 (not a refusal) when embedding fails', async () => {
    ;(globalThis as Record<string, unknown>).__topic = 'on'
    embeddingsCreate.mockRejectedValueOnce(new Error('openai down'))
    const res = await POST(makeReq('North Court'))
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.refused).toBeUndefined()
  })
})
