import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { retrieveChunks } from '@/lib/rag/retriever'
import { buildSources } from '@/lib/rag/sources'

const QuerySchema = z.object({
  q: z.string().min(1).max(800),
})

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = QuerySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { q } = parsed.data
  let chunks: Awaited<ReturnType<typeof retrieveChunks>>

  try {
    chunks = await retrieveChunks(q, 6)
  } catch (err) {
    console.error('[query] retrieval error:', err)
    chunks = []
  }

  // Refused-state: if no chunks retrieved, return refused=true
  const refused = chunks.length === 0

  // Provenance: deduped sources[] across the returned chunks (empty when refused)
  const sources = buildSources(chunks)

  return NextResponse.json({ chunks, refused, sources })
}