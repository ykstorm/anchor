import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'

export type RetrievedChunk = {
  sourceType: string
  sourceId: string
  content: string
  similarity: number
}

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Amenity-category detection ───────────────────────────────────────────────

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

// ── Retrieval ─────────────────────────────────────────────────────────────────

/**
 * Retrieve semantic chunks from the Embedding table.
 *
 * @param query       - Natural-language search query
 * @param k           - Max chunks to retrieve (default 6, min 10 for amenity queries)
 * @param simFloor    - Cosine similarity floor (default 0.30, 0.20 for amenity queries)
 */
export async function retrieveChunks(
  query: string,
  k: number = 6,
  simFloor: number = 0.30
): Promise<RetrievedChunk[]> {
  const amenityHits = detectAmenityCategories(query)
  const isAmenityQuery = amenityHits.length > 0
  const effectiveK = isAmenityQuery ? Math.max(k, 10) : k
  const effectiveSimFloor = isAmenityQuery ? 0.2 : simFloor

  try {
    const embeddingRes = await openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: query.slice(0, 2000),
    })
    const vec = embeddingRes.data[0].embedding
    const vecStr = `[${vec.join(',')}]`

    // DB query timeout — sub-second for normal, 5s for amenity queries
    const dbBudgetMs = isAmenityQuery ? 5000 : 1500
    const dbTimeout = new Promise<RetrievedChunk[]>((resolve) =>
      setTimeout(() => resolve([]), dbBudgetMs)
    )
    const dbQuery = prisma.$queryRawUnsafe<RetrievedChunk[]>(
      `SELECT "sourceType", "sourceId", "content",
        1 - (embedding <=> $1::vector) AS similarity
       FROM "Embedding"
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      vecStr,
      effectiveK
    )
    const rows = await Promise.race([dbQuery, dbTimeout])

    const filtered = (rows as RetrievedChunk[]).filter(
      (r) => Number(r.similarity) >= effectiveSimFloor
    )

    // Amenity boost: promote location_data rows whose content names the detected category
    if (!isAmenityQuery) return filtered
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
      return { row: r, score: Number(r.similarity) + bonus }
    })
    boosted.sort((a, b) => b.score - a.score)
    return boosted.map((b) => b.row)
  } catch {
    return []
  }
}