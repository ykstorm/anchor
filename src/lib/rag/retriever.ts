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
// query failed, or the DB budget was exceeded. A failure is NOT a refusal — the
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

// ── Amenity-category detection ──────────────────────────────────────────────

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

// ── Retrieval ───────────────────────────────────────────────────────────────

/**
 * Retrieve semantic chunks from the Embedding table.
 *
 * Amenity queries widen recall (more candidates, plus a category boost on
 * location_data rows) but the similarity floor is NEVER lowered by the query
 * text: a weak match stays a refusal.
 *
 * Throws RetrievalError if embedding or the DB query fails. An empty result
 * (no candidate cleared the floor) is a refusal, not an error.
 */
export async function retrieveChunks(
  query: string,
  k: number = 6,
  simFloor: number = SIM_FLOOR
): Promise<RetrievalResult> {
  const amenityHits = detectAmenityCategories(query)
  const isAmenityQuery = amenityHits.length > 0
  const effectiveK = isAmenityQuery ? Math.max(k, 10) : k
  const cleanQuery = sanitizeText(query)

  let vec: number[]
  try {
    const embeddingRes = await getOpenAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: cleanQuery,
    })
    vec = embeddingRes.data[0].embedding
  } catch (err) {
    throw new RetrievalError('embedding failed', err)
  }
  const vecStr = `[${vec.join(',')}]`

  let rows: RetrievedChunk[]
  try {
    const dbQuery = prisma.$queryRaw<RetrievedChunk[]>`
      SELECT "sourceType", "sourceId", "content",
        (1 - (embedding <=> ${vecStr}::vector))::float8 AS similarity
      FROM "Embedding"
      ORDER BY embedding <=> ${vecStr}::vector
      LIMIT ${effectiveK}
    `
    let timer: ReturnType<typeof setTimeout> | undefined
    const dbTimeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new RetrievalError('db query timed out')), DB_TIMEOUT_MS)
    })
    try {
      rows = await Promise.race([dbQuery, dbTimeout])
    } finally {
      if (timer) clearTimeout(timer)
    }
  } catch (err) {
    if (err instanceof RetrievalError) throw err
    throw new RetrievalError('db query failed', err)
  }

  const maxSimilarity = rows.length > 0
    ? Math.max(...rows.map((r) => r.similarity))
    : null

  const filtered = rows.filter((r) => r.similarity >= simFloor)

  // Amenity boost: promote location_data rows whose content names the detected category
  let chunks = filtered
  if (isAmenityQuery) {
    const boosted = filtered.map((r) => {
      let bonus = 0
      if (r.sourceType === 'location_data') {
        const contentLower = r.content.toLowerCase()
        if (amenityHits.some((c) => contentLower.startsWith(`${c} in `))) {
          bonus += 0.15
        } else {
          bonus += 0.05
        }
      }
      return { row: r, score: r.similarity + bonus }
    })
    boosted.sort((a, b) => b.score - a.score)
    chunks = boosted.map((b) => b.row)
  }

  return { chunks, floor: simFloor, maxSimilarity }
}
