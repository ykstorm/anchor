import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bestIndex,
  chunkRows,
  citations,
  formatBelow,
  readResponse,
  runQuery,
  statusOf,
  type QueryResponse,
} from '@/app/playground/query'

const chunk = (sourceId: string, similarity: number) => ({
  sourceType: 'project',
  sourceId,
  content: `text of ${sourceId}`,
  similarity,
})

const matched: QueryResponse = {
  // ranked order, with the amenity boost putting a lower score first
  chunks: [chunk('b', 0.41), chunk('a', 0.52)],
  refused: false,
  sources: [
    { sourceType: 'project', sourceId: 'a', similarity: 0.52, chunkCount: 1 },
    { sourceType: 'project', sourceId: 'b', similarity: 0.41, chunkCount: 1 },
  ],
  floor: 0.3,
  maxSimilarity: 0.52,
}

const refused: QueryResponse = { chunks: [], refused: true, sources: [], floor: 0.3, maxSimilarity: 0.14 }

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

describe('playground result helpers', () => {
  it('marks the highest score as the best match, not the first row', () => {
    expect(bestIndex(matched.chunks)).toBe(1)
    const rows = chunkRows(matched.chunks)
    expect(rows.map((r) => [r.id, r.score, r.best])).toEqual([
      ['chunk-1', '0.41', false],
      ['chunk-2', '0.52', true],
    ])
  })

  it('links each citation to the first chunk row from its source', () => {
    expect(citations(matched)).toEqual([
      { label: 'project:a', score: '0.52', href: '#chunk-2' },
      { label: 'project:b', score: '0.41', href: '#chunk-1' },
    ])
  })

  it('never rounds a refused best score up to the floor', () => {
    expect(formatBelow(0.14, 0.3)).toBe('0.14')
    expect(formatBelow(0.2996, 0.3)).toBe('0.299')
  })
})

describe('readResponse and statusOf', () => {
  it('reads a match and a refusal from a 200', async () => {
    const done = await readResponse(json(matched))
    expect(statusOf(done)).toEqual({ tone: 'ok', text: 'Matched. 2 chunks cleared the 0.30 floor.' })
    const no = await readResponse(json(refused))
    expect(statusOf(no)).toEqual({ tone: 'neutral', text: 'No answer. No chunk reached the 0.30 floor.' })
  })

  it('reports a 429 with its Retry-After', async () => {
    const state = await readResponse(json({ error: 'Too many requests' }, 429, { 'Retry-After': '37' }))
    expect(statusOf(state)).toEqual({ tone: 'bad', text: 'Too many requests. Try again in 37 seconds.' })
  })

  it('shows the 503 body and says nothing was searched', async () => {
    const state = await readResponse(json({ error: 'Retrieval temporarily unavailable' }, 503))
    expect(state).toEqual({ kind: 'unavailable', message: 'Retrieval temporarily unavailable' })
    expect(statusOf(state).text).toMatch(/^Retrieval temporarily unavailable \(HTTP 503\)\. Nothing was searched/)
  })

  it('falls back to the status code when the body is not JSON', async () => {
    const state = await readResponse(new Response('<html>bad gateway</html>', { status: 502 }))
    expect(statusOf(state)).toEqual({ tone: 'bad', text: 'Request failed (HTTP 502).' })
  })

  it('treats a 200 without the response shape as a failure', async () => {
    const state = await readResponse(json({ ok: true }))
    expect(statusOf(state)).toEqual({ tone: 'bad', text: 'Unexpected response (HTTP 200).' })
  })

  it('reports a network error when fetch itself fails', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))
    const state = await runQuery('anything')
    expect(statusOf(state)).toEqual({ tone: 'bad', text: 'Network error. The request did not reach the server.' })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})
