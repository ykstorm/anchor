import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { retrieveChunks, RetrievalError } from '@/lib/rag/retriever'
import { buildSources } from '@/lib/rag/sources'
import { enforceQueryRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const QuerySchema = z.object({
  q: z.string().min(1).max(800),
})

const NO_STORE = { 'Cache-Control': 'no-store' }

function json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { ...NO_STORE, ...(init?.headers ?? {}) },
  })
}

// Reject cross-site form/script POSTs. A missing Origin (curl, server-to-server)
// is allowed; a present Origin must match the request host.
function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.get('host')
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ error: 'Unsupported Media Type' }, { status: 415 })
  }

  if (!originAllowed(req)) {
    return json({ error: 'Forbidden origin' }, { status: 403 })
  }

  const limit = await enforceQueryRateLimit(req)
  if (!limit.ok) {
    return json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = QuerySchema.safeParse(body)
  if (!parsed.success) {
    return json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { q } = parsed.data

  let result: Awaited<ReturnType<typeof retrieveChunks>>
  try {
    result = await retrieveChunks(q, 6)
  } catch (err) {
    if (err instanceof RetrievalError) {
      console.error('[query] retrieval failed:', err.message)
      return json({ error: 'Retrieval temporarily unavailable' }, { status: 503 })
    }
    throw err
  }

  const { chunks, floor, maxSimilarity } = result
  const refused = chunks.length === 0
  const sources = buildSources(chunks)

  return json({ chunks, refused, sources, floor, maxSimilarity })
}
