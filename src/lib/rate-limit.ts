import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'

// Postgres-backed fixed-window rate limiter.
//
// Each window is a row in "RateLimit" keyed by a bucket string that encodes the
// caller identity and the time window. Counting is a single atomic upsert, so it
// is correct under concurrent requests and across serverless instances.
//
// The caller identity is sha256(ip + UTC date), truncated — the raw IP is never
// stored, so the table holds no directly identifying data.

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000

export type RateWindow = {
  /** Stable identity for this limit (already hashed; no raw IP). */
  key: string
  /** Max requests allowed within the window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export type RateLimitResult = {
  ok: boolean
  /** Seconds until the offending window resets (for the Retry-After header). */
  retryAfter: number
}

/** First hop in X-Forwarded-For, else X-Real-IP, else a constant fallback. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || '0.0.0.0'
}

/** Privacy-preserving caller id: sha256(ip + UTC date) truncated to 16 hex. */
export function ipHash(ip: string, now: Date = new Date()): string {
  const utcDate = now.toISOString().slice(0, 10)
  return createHash('sha256').update(`${ip}${utcDate}`).digest('hex').slice(0, 16)
}

async function hit(window: RateWindow, now: number): Promise<RateLimitResult> {
  const index = Math.floor(now / window.windowMs)
  const bucket = `${window.key}:${window.windowMs}:${index}`
  const expiresAt = new Date((index + 1) * window.windowMs)

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("bucket", "count", "expiresAt")
    VALUES (${bucket}, 1, ${expiresAt})
    ON CONFLICT ("bucket") DO UPDATE SET "count" = "RateLimit"."count" + 1
    RETURNING "count"::int AS count
  `
  const count = rows[0]?.count ?? 1

  // Best-effort opportunistic cleanup of long-expired rows.
  if (Math.random() < 0.02) {
    try {
      await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "expiresAt" < NOW()`
    } catch {
      // cleanup is non-critical
    }
  }

  if (count > window.limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)) }
  }
  return { ok: true, retryAfter: 0 }
}

/** Apply all windows; the first that is exceeded short-circuits with its retry. */
export async function hitRateLimit(windows: RateWindow[], now: number = Date.now()): Promise<RateLimitResult> {
  for (const w of windows) {
    const res = await hit(w, now)
    if (!res.ok) return res
  }
  return { ok: true, retryAfter: 0 }
}

/** /api/query limits: 20 requests/min per caller, 1000 requests/hour globally. */
export async function enforceQueryRateLimit(req: Request, now: Date = new Date()): Promise<RateLimitResult> {
  const id = ipHash(clientIp(req), now)
  return hitRateLimit(
    [
      { key: `query:ip:${id}`, limit: 20, windowMs: MINUTE_MS },
      { key: 'query:global', limit: 1000, windowMs: HOUR_MS },
    ],
    now.getTime()
  )
}

/** /api/admin/seed limit: 3 requests/hour per caller. */
export async function enforceSeedRateLimit(req: Request, now: Date = new Date()): Promise<RateLimitResult> {
  const id = ipHash(clientIp(req), now)
  return hitRateLimit([{ key: `seed:ip:${id}`, limit: 3, windowMs: HOUR_MS }], now.getTime())
}
