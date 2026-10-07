import type { ChunkRow } from '@/components/ui/ChunkList'
import type { StatusTone } from '@/components/ui/StatusLine'
import type { RetrievedChunk } from '@/lib/rag/retriever'
import type { Source } from '@/lib/rag/sources'

// The 200 body of POST /api/query (src/app/api/query/route.ts).
export type QueryResponse = {
  chunks: RetrievedChunk[]
  refused: boolean
  sources: Source[]
  floor: number
  maxSimilarity: number | null
}

export type QueryState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; data: QueryResponse }
  | { kind: 'limited'; message: string; retryAfter: number | null }
  | { kind: 'unavailable'; message: string }
  | { kind: 'failed'; status: number; message: string }
  | { kind: 'offline' }

type Citation = { label: string; score: string; href: string }

export function formatScore(score: number): string {
  return Number(score).toFixed(2)
}

// A score under the floor that rounds up to it gets a third decimal, so the
// page never says "best 0.30" next to "floor 0.30" for a refusal.
export function formatBelow(score: number, floor: number): string {
  const short = formatScore(score)
  return Number(short) < floor ? short : (Math.floor(score * 1000) / 1000).toFixed(3)
}

const chunkId = (index: number) => `chunk-${index + 1}`
const sourceLabel = (s: { sourceType: string; sourceId: string }) => `${s.sourceType}:${s.sourceId}`

// The highest score wins, the first chunk on a tie. Chunks arrive in ranked
// order, and the amenity boost can move a lower score to the top.
export function bestIndex(chunks: RetrievedChunk[]): number {
  let best = 0
  chunks.forEach((c, i) => {
    if (Number(c.similarity) > Number(chunks[best].similarity)) best = i
  })
  return best
}

export function chunkRows(chunks: RetrievedChunk[]): ChunkRow[] {
  const best = bestIndex(chunks)
  return chunks.map((c, i) => ({
    id: chunkId(i),
    source: sourceLabel(c),
    score: formatScore(c.similarity),
    text: c.content,
    best: i === best,
  }))
}

// One citation per source, linked to the first chunk row from that source.
export function citations(data: QueryResponse): Citation[] {
  return data.sources.map((s) => {
    const label = sourceLabel(s)
    const first = data.chunks.findIndex((c) => sourceLabel(c) === label)
    return { label, score: formatScore(s.similarity), href: `#${chunkId(first)}` }
  })
}

function isQueryResponse(body: unknown): body is QueryResponse {
  const b = body as Partial<QueryResponse> | null
  return Array.isArray(b?.chunks) && Array.isArray(b?.sources) && typeof b?.floor === 'number'
}

function errorText(body: unknown): string | null {
  const error = (body as { error?: unknown } | null)?.error
  return typeof error === 'string' ? error : null
}

function seconds(header: string | null): number | null {
  const n = Number(header)
  return header && Number.isFinite(n) && n > 0 ? Math.ceil(n) : null
}

export async function readResponse(res: Response): Promise<QueryState> {
  const body: unknown = await res.json().catch(() => null)
  if (res.ok && isQueryResponse(body)) return { kind: 'done', data: body }
  const message = errorText(body) ?? (res.ok ? 'Unexpected response' : 'Request failed')
  if (res.status === 429) {
    return { kind: 'limited', message, retryAfter: seconds(res.headers.get('Retry-After')) }
  }
  if (res.status === 503) return { kind: 'unavailable', message }
  return { kind: 'failed', status: res.status, message }
}

export async function runQuery(q: string): Promise<QueryState> {
  let res: Response
  try {
    res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q }),
    })
  } catch {
    return { kind: 'offline' }
  }
  return readResponse(res)
}

function doneStatus(data: QueryResponse): { tone: StatusTone; text: string } {
  const floor = formatScore(data.floor)
  if (data.refused) return { tone: 'neutral', text: `No answer. No chunk reached the ${floor} floor.` }
  const n = data.chunks.length
  return { tone: 'ok', text: `Matched. ${n} chunk${n === 1 ? '' : 's'} cleared the ${floor} floor.` }
}

function retryText(after: number | null): string {
  if (after === null) return 'Try again in a minute.'
  return `Try again in ${after} second${after === 1 ? '' : 's'}.`
}

export function statusOf(state: QueryState): { tone: StatusTone; text: string } {
  switch (state.kind) {
    case 'idle':
      return { tone: 'neutral', text: 'Ready. Press Enter to search.' }
    case 'loading':
      return { tone: 'neutral', text: 'Searching…' }
    case 'done':
      return doneStatus(state.data)
    case 'limited':
      return { tone: 'bad', text: `${state.message}. ${retryText(state.retryAfter)}` }
    case 'unavailable':
      return {
        tone: 'bad',
        text: `${state.message} (HTTP 503). Nothing was searched, so this is a failure, not a no-answer result.`,
      }
    case 'failed':
      return { tone: 'bad', text: `${state.message} (HTTP ${state.status}).` }
    case 'offline':
      return { tone: 'bad', text: 'Network error. The request did not reach the server.' }
  }
}
