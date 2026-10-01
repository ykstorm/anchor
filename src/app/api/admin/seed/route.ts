import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { enforceSeedRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Constant-time token comparison that is also safe when lengths differ.
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  const expected = process.env.SEED_TOKEN
  const provided = req.headers.get('x-seed-token') ?? ''
  if (!expected || !tokenMatches(provided, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const limit = await enforceSeedRateLimit(req)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  try {
    const { seedDemoData } = await import('@/lib/rag/demo-seeder')
    const { embedAndStore } = await import('@/lib/rag/seed-runner')
    const loaded = await seedDemoData()
    const embedded = await embedAndStore()
    return NextResponse.json({ ok: true, loaded, embedded })
  } catch (e) {
    console.error('[admin/seed] failed:', e)
    return NextResponse.json({ ok: false, error: 'seed failed' }, { status: 500 })
  }
}
