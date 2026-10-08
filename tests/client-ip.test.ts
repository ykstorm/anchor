import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { clientIp, NO_CLIENT_IP } from '@/lib/client-ip'

function reqWith(headers: Record<string, string> | Headers = {}): Request {
  return new Request('http://localhost/api/query', { method: 'POST', headers })
}

function xff(value: string): Request {
  return reqWith({ 'x-forwarded-for': value })
}

beforeEach(() => {
  delete process.env.TRUST_PROXY_HOPS
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('clientIp with the default of one trusted hop', () => {
  it('takes the right-most entry, the one the trusted proxy wrote', () => {
    expect(clientIp(xff('203.0.113.9'))).toBe('203.0.113.9')
    expect(clientIp(xff('10.9.9.9, 203.0.113.9'))).toBe('203.0.113.9')
  })

  it('ignores any address the caller prepends', () => {
    const real = '203.0.113.9'
    expect(clientIp(xff(`1.1.1.1, ${real}`))).toBe(real)
    expect(clientIp(xff(`1.1.1.1, 2.2.2.2, 3.3.3.3, ${real}`))).toBe(real)
    expect(clientIp(xff(`2001:db8::bad, ${real}`))).toBe(real)
  })

  it('gives every forged prefix the same answer, so no fresh bucket per request', () => {
    const ips = new Set(
      ['1.1.1.1', '2.2.2.2', '9.9.9.9', '10.0.0.1'].map((fake) => clientIp(xff(`${fake}, 203.0.113.9`)))
    )
    expect(ips).toEqual(new Set(['203.0.113.9']))
  })

  it('reads an IPv6 entry', () => {
    expect(clientIp(xff('1.1.1.1, 2001:db8::1'))).toBe('2001:db8::1')
  })

  it('tolerates spaces around the entries', () => {
    expect(clientIp(xff('  1.1.1.1 ,   203.0.113.9  '))).toBe('203.0.113.9')
  })

  it('reads a header that arrived as several lines as one chain', () => {
    const headers = new Headers()
    headers.append('x-forwarded-for', '1.1.1.1')
    headers.append('x-forwarded-for', '203.0.113.9')
    expect(clientIp(reqWith(headers))).toBe('203.0.113.9')
  })
})

describe('clientIp when the header is missing', () => {
  it('returns the shared fallback', () => {
    expect(clientIp(reqWith())).toBe(NO_CLIENT_IP)
  })

  it('does not fall back to x-real-ip, which a caller can set', () => {
    expect(clientIp(reqWith({ 'x-real-ip': '198.51.100.7' }))).toBe(NO_CLIENT_IP)
  })

  it('returns the shared fallback for an empty header', () => {
    expect(clientIp(xff(''))).toBe(NO_CLIENT_IP)
    expect(clientIp(xff('   '))).toBe(NO_CLIENT_IP)
    expect(clientIp(xff(' , ,'))).toBe(NO_CLIENT_IP)
  })
})

describe('clientIp when the header is malformed', () => {
  it('returns the shared fallback when the trusted entry is not an address', () => {
    expect(clientIp(xff('unknown'))).toBe(NO_CLIENT_IP)
    expect(clientIp(xff('not-an-ip'))).toBe(NO_CLIENT_IP)
    expect(clientIp(xff('999.1.1.1'))).toBe(NO_CLIENT_IP)
    expect(clientIp(xff('203.0.113.9:4711'))).toBe(NO_CLIENT_IP)
    expect(clientIp(xff('<script>alert(1)</script>'))).toBe(NO_CLIENT_IP)
  })

  it('does not fall through to a caller-supplied entry on the left', () => {
    expect(clientIp(xff('1.1.1.1, unknown'))).toBe(NO_CLIENT_IP)
  })
})

describe('clientIp with TRUST_PROXY_HOPS', () => {
  it('counts that many entries from the right', () => {
    vi.stubEnv('TRUST_PROXY_HOPS', '2')
    expect(clientIp(xff('1.1.1.1, 203.0.113.9, 10.0.0.2'))).toBe('203.0.113.9')
    vi.stubEnv('TRUST_PROXY_HOPS', '3')
    expect(clientIp(xff('1.1.1.1, 203.0.113.9, 10.0.0.2, 10.0.0.3'))).toBe('203.0.113.9')
  })

  it('still ignores whatever the caller prepends', () => {
    vi.stubEnv('TRUST_PROXY_HOPS', '2')
    expect(clientIp(xff('5.5.5.5, 6.6.6.6, 7.7.7.7, 203.0.113.9, 10.0.0.2'))).toBe('203.0.113.9')
  })

  it('returns the shared fallback when the chain is shorter than the hop count', () => {
    vi.stubEnv('TRUST_PROXY_HOPS', '3')
    expect(clientIp(xff('203.0.113.9, 10.0.0.2'))).toBe(NO_CLIENT_IP)
    expect(clientIp(reqWith())).toBe(NO_CLIENT_IP)
  })

  it('returns the shared fallback when the entry at that position is not an address', () => {
    vi.stubEnv('TRUST_PROXY_HOPS', '2')
    expect(clientIp(xff('unknown, 10.0.0.2'))).toBe(NO_CLIENT_IP)
  })

  it('accepts surrounding spaces in the setting', () => {
    vi.stubEnv('TRUST_PROXY_HOPS', ' 2 ')
    expect(clientIp(xff('1.1.1.1, 203.0.113.9, 10.0.0.2'))).toBe('203.0.113.9')
  })

  it.each(['', 'abc', '0', '-1', '1.5', '1e1', '2 hops', 'NaN'])(
    'reads %j as the default of one hop',
    (value) => {
      vi.stubEnv('TRUST_PROXY_HOPS', value)
      expect(clientIp(xff('1.1.1.1, 203.0.113.9'))).toBe('203.0.113.9')
    }
  )
})
