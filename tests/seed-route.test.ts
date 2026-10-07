import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The real rate limiter runs here. Only the database is replaced: $queryRaw
// emulates the "RateLimit" upsert with an in-memory counter keyed by bucket.
const { counts, queryRaw, seedDemoData, embedAndStore } = vi.hoisted(() => {
  const counts = new Map<string, number>()
  return {
    counts,
    queryRaw: vi.fn(async (_strings: unknown, bucket: string) => {
      const next = (counts.get(bucket) ?? 0) + 1
      counts.set(bucket, next)
      return [{ count: next }]
    }),
    seedDemoData: vi.fn(async () => ({ projects: 1 })),
    embedAndStore: vi.fn(async () => ({ embedded: 1 })),
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: queryRaw, $executeRaw: vi.fn(async () => 0) } }))
vi.mock('@/lib/rag/demo-seeder', () => ({ seedDemoData }))
vi.mock('@/lib/rag/seed-runner', () => ({ embedAndStore }))

import { POST } from '@/app/api/admin/seed/route'

const TOKEN = 'correct-token-value'

function makeReq(token?: string, ip = '203.0.113.9') {
  const headers: Record<string, string> = { 'x-forwarded-for': ip }
  if (token !== undefined) headers['x-seed-token'] = token
  return new Request('http://localhost/api/admin/seed', {
    method: 'POST',
    headers,
  }) as unknown as Parameters<typeof POST>[0]
}

beforeEach(() => {
  counts.clear()
  queryRaw.mockClear()
  seedDemoData.mockClear()
  embedAndStore.mockClear()
  process.env.SEED_TOKEN = TOKEN
  // Skip the limiter's opportunistic cleanup deterministically.
  vi.spyOn(Math, 'random').mockReturnValue(0.99)
})

afterEach(() => {
  delete process.env.SEED_TOKEN
  vi.restoreAllMocks()
})

describe('POST /api/admin/seed', () => {
  it('counts a wrong token against the limit, so guesses end in 429', async () => {
    // The limit is 3 per hour per caller: three wrong guesses are answered 401 ...
    for (let i = 0; i < 3; i++) {
      expect((await POST(makeReq('wrong-token'))).status).toBe(401)
    }
    expect(queryRaw).toHaveBeenCalledTimes(3)

    // ... and the fourth is stopped by the limiter, not by the token check.
    const blocked = await POST(makeReq('wrong-token'))
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(seedDemoData).not.toHaveBeenCalled()
  })

  it('refuses even the right token once wrong guesses have used the limit', async () => {
    for (let i = 0; i < 3; i++) await POST(makeReq('wrong-token'))

    const res = await POST(makeReq(TOKEN))
    expect(res.status).toBe(429)
    expect(seedDemoData).not.toHaveBeenCalled()
  })

  it('does not let one caller use up another caller\'s limit', async () => {
    for (let i = 0; i < 4; i++) await POST(makeReq('wrong-token', '198.51.100.1'))

    const res = await POST(makeReq(TOKEN, '198.51.100.2'))
    expect(res.status).toBe(200)
  })

  it('seeds when the token is right and the caller is under the limit', async () => {
    const res = await POST(makeReq(TOKEN))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, loaded: { projects: 1 }, embedded: { embedded: 1 } })
    expect(seedDemoData).toHaveBeenCalledTimes(1)
    expect(embedAndStore).toHaveBeenCalledTimes(1)
  })

  it('answers 401 for a missing token header', async () => {
    const res = await POST(makeReq())
    expect(res.status).toBe(401)
    expect(seedDemoData).not.toHaveBeenCalled()
  })

  it('is switched off without SEED_TOKEN: 401 and no database write', async () => {
    delete process.env.SEED_TOKEN

    const res = await POST(makeReq('anything'))
    expect(res.status).toBe(401)
    expect(queryRaw).not.toHaveBeenCalled()
    expect(seedDemoData).not.toHaveBeenCalled()
  })
})
