import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getOpenAI } from '@/lib/openai'
import { sanitizeText } from '@/lib/rag/sanitize'

export type RetrievedChunk = {
  sourceType: string
  sourceId: string
  content: string
  similarity: number
}

export type RetrievalResult = {
  chunks: RetrievedChunk[]
  floor: number
  // Best cosine similarity among the candidates considered, before the floor
  // filter. null when the corpus returned no rows. Lets callers explain a
  // refusal ("best match was 0.21, floor is 0.30") without guessing.
  maxSimilarity: number | null
}

// Thrown when retrieval cannot complete: the embedding call failed, the DB
// query failed, or the DB budget was exceeded. A failure is NOT a refusal, the
// caller turns this into a 503, never an empty "no answer" result.
export class RetrievalError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'RetrievalError'
  }
}

// Cosine similarity floor. A match below this is treated as too weak to answer
// from, so retrieval returns no chunks and the caller refuses. Exported so docs,
// tests, and the API response all read the same number. This is a property of
// the corpus (calibrate it), never lowered by the query text.
export const SIM_FLOOR = 0.30

// Milliseconds to wait on the pgvector query before treating it as a failure.
const DB_TIMEOUT_MS = 5000

// Query-embedding cache: identical queries reuse their vector instead of paying
// for another embedding call. Small LRU keyed by sha256 of the sanitized query.
const EMBED_CACHE_MAX = 500
const embedCache = new Map<string, number[]>()

function cacheGet(key: string): number[] | undefined {
  const vec = embedCache.get(key)
  if (vec) {
    embedCache.delete(key)
    embedCache.set(key, vec)
  }
  return vec
}

function cacheSet(key: string, vec: number[]): void {
  embedCache.set(key, vec)
  if (embedCache.size > EMBED_CACHE_MAX) {
    const oldest = embedCache.keys().next().value
    if (oldest !== undefined) embedCache.delete(oldest)
  }
}

// Amenity-category detection

const AMENITY_CATEGORIES: Record<string, RegExp> = {
  park:      /\b(park|parks|garden|gardens)\b/i,
  hospital:  /\b(hospital|hospitals|clinic|clinics|healthcare)\b/i,
  atm:       /\b(atm|atms|cash\s*machine)\b/i,
  bank:      /\b(bank|banks|branch|branches)\b/i,
  school:    /\b(school|schools|college|colleges|university|universities|institute)\b/i,
  mall:      /\b(mall|malls|shopping|shop|store|supermarket)\b/i,
  club:      /\b(club|clubs|gym|gyms|sports|fitness)\b/i,
  temple:    /\b(temple|temples|mandir)\b/i,
  transport: /\b(metro|brts|bus|transport|station|commute)\b/i,
}

export function detectAmenityCategories(query: string): string[] {
  const hit: string[] = []
  for (const [cat, rx] of Object.entries(AMENITY_CATEGORIES)) {
    if (rx.test(query)) hit.push(cat)
  }
  // Buyers use ATM/bank interchangeably
  if (hit.includes('atm') && !hit.includes('bank')) hit.push('bank')
  if (hit.includes('bank') && !hit.includes('atm')) hit.push('atm')
  return hit
}

// Embed a sanitized query, with an LRU cache. Throws RetrievalError on failure.
export async function embedQuery(cleanQuery: string): Promise<number[]> {
  const key = createHash('sha256').update(cleanQuery).digest('hex')
  const cached = cacheGet(key)
  if (cached) return cached
  try {
    const res = await getOpenAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: cleanQuery,
    })
    const vec = res.data[0].embedding
    cacheSet(key, vec)
    return vec
  } catch (err) {
    throw new RetrievalError('embedding failed', err)
  }
}

// Run the pgvector cosine search under a time budget. Throws RetrievalError on
// failure or timeout.
export async function searchVectors(vec: number[], k: number): Promise<RetrievedChunk[]> {
  const vecStr = `[${vec.join(',')}]`
  try {
    const dbQuery = prisma.$queryRaw<RetrievedChunk[]>`
      SELECT "sourceType", "sourceId", "content",
        (1 - (embedding <=> ${vecStr}::vector))::float8 AS similarity
      FROM "Embedding"
      ORDER BY embedding <=> ${vecStr}::vector
      LIMIT ${k}
    `
    let timer: ReturnType<typeof setTimeout> | undefined
    const dbTimeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new RetrievalError('db query timed out')), DB_TIMEOUT_MS)
    })
    try {
      return await Promise.race([dbQuery, dbTimeout])
    } finally {
      if (timer) clearTimeout(timer)
    }
  } catch (err) {
    if (err instanceof RetrievalError) throw err
    throw new RetrievalError('db query failed', err)
  }
}

// Reorder amenity results: promote location_data rows that name a detected
// category. Pure, no I/O.
export function rerankAmenity(chunks: RetrievedChunk[], amenityHits: string[]): RetrievedChunk[] {
  const scored = chunks.map((r) => {
    let bonus = 0
    if (r.sourceType === 'location_data') {
      const contentLower = r.content.toLowerCase()
      bonus = amenityHits.some((c) => contentLower.startsWith(`${c} in `)) ? 0.15 : 0.05
    }
    return { row: r, score: r.similarity + bonus }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.row)
}

/**
 * Retrieve semantic chunks from the Embedding table.
 *
 * Amenity queries widen recall (more candidates, plus a category boost) but the
 * similarity floor is NEVER lowered by the query text: a weak match stays a
 * refusal. Throws RetrievalError if embedding or the DB query fails. An empty
 * result (no candidate cleared the floor) is a refusal, not an error.
 */
export async function retrieveChunks(
  query: string,
  k: number = 6,
  simFloor: number = SIM_FLOOR
): Promise<RetrievalResult> {
  const amenityHits = detectAmenityCategories(query)
  const isAmenityQuery = amenityHits.length > 0
  const effectiveK = isAmenityQuery ? Math.max(k, 10) : k

  const vec = await embedQuery(sanitizeText(query))
  const rows = await searchVectors(vec, effectiveK)

  const maxSimilarity = rows.length > 0 ? Math.max(...rows.map((r) => r.similarity)) : null
  const filtered = rows.filter((r) => r.similarity >= simFloor)
  const chunks = isAmenityQuery ? rerankAmenity(filtered, amenityHits) : filtered

  return { chunks, floor: simFloor, maxSimilarity }
}
