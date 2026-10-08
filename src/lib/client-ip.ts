import { isIP } from 'node:net'

// The caller address used to key the rate limiter.
//
// X-Forwarded-For is a list. Every proxy that handles a request adds the
// address it received the request from to the right-hand end, but the caller
// can send the header with any entries it likes, and those stay on the left.
// So the left-most entry is whatever the caller wrote, and the only entries
// that can be trusted are the ones added by proxies we run or rely on. Those
// sit at the right-hand end, so this module counts from the right.
//
// TRUST_PROXY_HOPS is how many proxies in front of the app add an entry.
// The client address is the entry that many places from the right. The default
// is 1, which is right for Vercel. Vercel documents that it overwrites
// X-Forwarded-For with the client's public address and does not forward
// external values, so on Vercel the header has exactly one entry and it is the
// one Vercel wrote. Set a higher number only when the app sits behind more
// proxies that each append to the header, for example a CDN in front of a load
// balancer in front of the app.
//
// X-Real-IP is not read. Outside Vercel the caller can send it.

/** Shared by every request whose address cannot be determined. */
export const NO_CLIENT_IP = '0.0.0.0'

const DEFAULT_TRUST_PROXY_HOPS = 1

function trustedHops(): number {
  const raw = process.env.TRUST_PROXY_HOPS?.trim() ?? ''
  if (!/^\d+$/.test(raw)) return DEFAULT_TRUST_PROXY_HOPS
  const hops = Number(raw)
  return hops >= 1 ? hops : DEFAULT_TRUST_PROXY_HOPS
}

/**
 * The client address, counted from the right of X-Forwarded-For. When the
 * header is missing, is shorter than the hop count, or the entry at that
 * position is not an IP address, every such request shares NO_CLIENT_IP and
 * so shares one rate-limit bucket. It never falls back to an entry further
 * left, because those are the ones a caller can forge.
 */
export function clientIp(req: Request): string {
  const chain = (req.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  const entry = chain[chain.length - trustedHops()]
  return entry !== undefined && isIP(entry) !== 0 ? entry : NO_CLIENT_IP
}
