import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { retrieveChunks } from '@/lib/rag/retriever'
import { buildSources } from '@/lib/rag/sources'

const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(2000),
  })).min(1).max(30),
  sessionId: z.string().nullish(),
})

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = ChatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request format', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const messages = parsed.data.messages
  const latestMsg = messages[messages.length - 1]?.content ?? ''

  if (latestMsg.length > 800) {
    return NextResponse.json(
      { error: 'Message too long. Please keep questions under 800 characters.' },
      { status: 400 }
    )
  }

  // Retrieve relevant RAG chunks (k=6, score floor 0.30)
  let chunks: Awaited<ReturnType<typeof retrieveChunks>>
  try {
    chunks = await retrieveChunks(latestMsg, 6)
  } catch (err) {
    console.error('[RAG] Retrieval error:', err)
    // Graceful degradation — return empty chunks rather than failing
    chunks = [] as typeof chunks
  }

  // Provenance: deduped sources[] across the returned chunks (empty when refused)
  const sources = buildSources(chunks)
  const refused = chunks.length === 0

  return NextResponse.json({
    query: latestMsg,
    chunks,
    chunkCount: chunks.length,
    refused,
    sources,
    // In a full implementation, chunks would be injected into the system prompt
    // and the response would be streamed via Vercel AI SDK
  })
}