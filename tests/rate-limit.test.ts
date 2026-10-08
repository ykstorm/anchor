import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryRaw, executeRaw } = vi.hoisted(() => ({
  queryRaw: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  executeRaw: vi.fn(async () => 0),
}))

vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: queryRaw, $executeRaw: executeRaw } }))

import {
  ipHash,
  hitRateLimit,
  enforceQueryRateLimit,
  enforceSeedRateLimit,
} from '@/lib/rate-limit'

function reqWith(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/query', { method: 'POST', headers })
}

beforeEach(() => {
  queryRaw.mockReset()
  executeRaw.mockClear()
  // Skip the opportunistic cleanup branch deterministically.
  vi.spyOn(Math, 'random').mockReturnValue(0.99)
})

describe('ipHash', () => {
  it('is 16 hex chars and never contains the raw IP', () => {
    const ip = '203.0.113.9'
    const h = ipHash(ip, new Date('2026-10-01T00:00:00Z'))
    expect(h).toMatch(/^[0-9a-f]{16}$/)
    expect(h).not.toContain(ip)
  })
  it('differs by IP', () => {
    const now = new Date('2026-10-01T00:00:00Z')
    expect(ipHash('1.1.1.1', now)).not.toBe(ipHash('2.2.2.2', now))
  })
})

describe('hitRateLimit', () => {
  it('allows while under the limit', async () => {
    queryRaw.mockResolvedValue([{ count: 5 }])
    const res = await hitRateLimit([{ key: 'k', limit: 20, windowMs: 60_000 }], Date.now())
    expect(res.ok).toBe(true)
  })

  it('blocks and returns a positive Retry-After once over the limit', async () => {
    queryRaw.mockResolvedValue([{ count: 21 }])
    const res = await hitRateLimit([{ key: 'k', limit: 20, windowMs: 60_000 }], Date.now())
    expect(res.ok).toBe(false)
    expect(res.retryAfter).toBeGreaterThan(0)
  })
})

describe('enforceQueryRateLimit', () => {
  it('passes when both the per-IP and global windows are under limit', async () => {
    queryRaw.mockResolvedValue([{ count: 1 }])
    const res = await enforceQueryRateLimit(reqWith({ 'x-forwarded-for': '203.0.113.9' }))
    expect(res.ok).toBe(true)
    // one call for the per-IP window, one for the global window
    expect(queryRaw).toHaveBeenCalledTimes(2)
  })

  it('blocks on the per-IP window (20/min) before checking global', async () => {
    queryRaw.mockResolvedValueOnce([{ count: 21 }])
    const res = await enforceQueryRateLimit(reqWith({ 'x-forwarded-for': '203.0.113.9' }))
    expect(res.ok).toBe(false)
    expect(queryRaw).toHaveBeenCalledTimes(1)
  })

  it('keys the bucket on the trusted address, not on a prepended one', async () => {
    queryRaw.mockResolvedValue([{ count: 1 }])
    await enforceQueryRateLimit(reqWith({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }))
    await enforceQueryRateLimit(reqWith({ 'x-forwarded-for': '2.2.2.2, 203.0.113.9' }))
    const bucketOf = (call: number) => queryRaw.mock.calls[call][1]
    // calls 0 and 2 are the per-IP windows, 1 and 3 the global window
    expect(bucketOf(0)).toBe(bucketOf(2))
    expect(bucketOf(1)).toBe(bucketOf(3))
  })

  it('blocks on the global window (1000/hr)', async () => {
    queryRaw.mockResolvedValueOnce([{ count: 1 }]).mockResolvedValueOnce([{ count: 1001 }])
    const res = await enforceQueryRateLimit(reqWith({ 'x-forwarded-for': '203.0.113.9' }))
    expect(res.ok).toBe(false)
    expect(queryRaw).toHaveBeenCalledTimes(2)
  })
})

describe('enforceSeedRateLimit', () => {
  it('blocks after 3/hr', async () => {
    queryRaw.mockResolvedValueOnce([{ count: 4 }])
    const res = await enforceSeedRateLimit(reqWith({ 'x-forwarded-for': '203.0.113.9' }))
    expect(res.ok).toBe(false)
  })
})
