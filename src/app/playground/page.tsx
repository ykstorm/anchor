'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

interface Chunk {
  sourceType: string
  sourceId: string
  content: string
  similarity: number
}

interface Source {
  sourceId: string
  sourceType: string
  similarity: number
  chunkCount: number
}

function PlaygroundInner() {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ chunks: Chunk[]; refused: boolean; sources?: Source[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query.trim() }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  function similarityColor(sim: number): string {
    if (sim >= 0.75) return 'text-emerald-400'
    if (sim >= 0.50) return 'text-yellow-400'
    return 'text-gray-500'
  }

  function sourceBadge(type: string): string {
    const colors: Record<string, string> = {
      project: 'bg-blue-500/10 text-blue-400',
      builder: 'bg-purple-500/10 text-purple-400',
      locality: 'bg-orange-500/10 text-orange-400',
      infra: 'bg-cyan-500/10 text-cyan-400',
      location_data: 'bg-emerald-500/10 text-emerald-400',
    }
    return colors[type] ?? 'bg-gray-500/10 text-gray-400'
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-800">
        <div className="text-lg font-bold tracking-tight">
          <a href="/" className="hover:text-emerald-400 transition-colors">← Anchor</a>
        </div>
        <div className="text-sm text-gray-400">Playground</div>
      </nav>

      {/* Query form */}
      <div className="max-w-3xl mx-auto px-8 pt-16 pb-8">
        <h1 className="text-3xl font-bold mb-2">RAG Playground</h1>
        <p className="text-gray-400 mb-8">
          Query the vector store directly. No LLM — just retrieval.
          <span className="text-gray-600"> When chunks = 0, the answer is refused.</span>
        </p>
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Which Goyal & Co. projects in Shela are ready to move in?"
            className="flex-1 px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors text-sm"
            maxLength={800}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm transition-colors"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="max-w-3xl mx-auto px-8 pb-24">
          {/* Status bar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">chunks</span>
              <span className={`text-2xl font-bold ${result.chunks.length > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.chunks.length}
              </span>
            </div>
            {result.refused && (
              <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                REFUSED — no relevant chunks
              </span>
            )}
            {!result.refused && result.chunks.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                RETRIEVED — answering
              </span>
            )}
          </div>

          {/* Sources — deduped provenance across the returned chunks */}
          {result.sources && result.sources.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                sources ({result.sources.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {result.sources.map((s, i) => (
                  <span
                    key={i}
                    className={`text-xs font-mono px-2 py-1 rounded ${sourceBadge(s.sourceType)}`}
                    title={`${s.chunkCount} chunk(s) · best similarity ${Number(s.similarity).toFixed(3)}`}
                  >
                    {s.sourceType}:{s.sourceId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Chunks */}
          {result.chunks.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <div className="text-4xl mb-4">∅</div>
              <p className="text-sm">No chunks above similarity threshold.</p>
              <p className="text-xs mt-1">Response would be refused in production.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.chunks.map((chunk, i) => (
                <div key={i} className="px-5 py-4 rounded-xl border border-gray-800 bg-gray-900/60 hover:border-gray-700 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${sourceBadge(chunk.sourceType)}`}>
                      {chunk.sourceType}
                    </span>
                    <span className={`text-xs font-mono ${similarityColor(Number(chunk.similarity))}`}>
                      {Number(chunk.similarity).toFixed(3)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{chunk.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="max-w-3xl mx-auto px-8 pb-24 text-center py-12">
          <p className="text-gray-600 text-sm">Results will appear here</p>
        </div>
      )}
    </div>
  )
}

import { Suspense } from 'react'

export default function PlaygroundPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <PlaygroundInner />
    </Suspense>
  )
}