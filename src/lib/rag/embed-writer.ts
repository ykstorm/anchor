import { getEncoding } from 'js-tiktoken'
import { prisma } from '@/lib/prisma'
import { getOpenAI } from '@/lib/openai'
import { sanitizeText } from '@/lib/rag/sanitize'

export type SourceType = 'project' | 'builder' | 'locality' | 'infra' | 'location_data'

const enc = getEncoding('cl100k_base')

function countTokens(text: string): number {
  return enc.encode(text).length
}

// Chunk templates
type ProjectChunkInput = {
  id: string
  projectName: string
  builderName: string
  microMarket: string
  configurations: string | null
  minPrice: number
  maxPrice: number
  possessionDate: Date
  amenities: string[]
  honestConcern: string | null
  analystNote: string | null
  priceNote: string | null
  decisionTag: string | null
}

/** The price band in crore, or null unless both ends are known. */
function rupeeBand(minPrice: number, maxPrice: number): string | null {
  if (minPrice > 0 && maxPrice > 0) {
    return `₹${(minPrice / 1e7).toFixed(1)}Cr – ₹${(maxPrice / 1e7).toFixed(1)}Cr`
  }
  return null
}

function configurationLine(configurations: string | null, priceRange: string | null): string {
  const configs = `Configurations: ${configurations ?? 'not specified'}.`
  return priceRange ? `${configs} Price range: ${priceRange}.` : configs
}

function amenityList(amenities: string[]): string {
  return amenities.length > 0 ? amenities.join(', ') : 'not listed'
}

/** The optional notes, in the order they are written; empty ones are left out. */
const PROJECT_NOTES = [
  ['honestConcern', 'Honest concern'],
  ['analystNote', 'Analyst note'],
  ['priceNote', 'Price note'],
  ['decisionTag', 'Decision tag'],
] as const

function projectNotes(p: ProjectChunkInput): string[] {
  return PROJECT_NOTES.filter(([field]) => p[field]).map(([field, label]) => `${label}: ${p[field]}`)
}

export function chunkForProject(p: ProjectChunkInput): string {
  const possession = p.possessionDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
  const lines: string[] = [
    `Project: ${p.projectName} by ${p.builderName}, located in ${p.microMarket}.`,
    configurationLine(p.configurations, rupeeBand(p.minPrice, p.maxPrice)),
    `Possession: ${possession}. Amenities: ${amenityList(p.amenities)}.`,
    ...projectNotes(p),
  ]
  return lines.join(' ')
}

// Compile-time guard, prevents sensitive builder fields from reaching AI context
export type BuilderAIContext = {
  id: string
  brandName: string | null | undefined
  totalTrustScore: number | null | undefined
  grade: string | null | undefined
  deliveryScore: number | null | undefined
  reraScore: number | null | undefined
  qualityScore: number | null | undefined
  financialScore: number | null | undefined
  responsivenessScore: number | null | undefined
}

export function chunkForBuilder(b: BuilderAIContext): string {
  const brand = b.brandName ?? 'Unknown builder'
  const grade = b.grade ?? 'N/A'
  const total = b.totalTrustScore != null ? `${b.totalTrustScore}/100` : 'N/A'
  const delivery = b.deliveryScore != null ? `${b.deliveryScore}` : 'N/A'
  const rera = b.reraScore != null ? `${b.reraScore}` : 'N/A'
  const quality = b.qualityScore != null ? `${b.qualityScore}` : 'N/A'
  const financial = b.financialScore != null ? `${b.financialScore}` : 'N/A'
  const responsive = b.responsivenessScore != null ? `${b.responsivenessScore}` : 'N/A'
  return (
    `Builder: ${brand}. Trust grade: ${grade}, overall trust score ${total}. ` +
    `Delivery score: ${delivery}, RERA compliance score: ${rera}, ` +
    `construction quality score: ${quality}, financial stability score: ${financial}, ` +
    `responsiveness score: ${responsive}.`
  )
}

export function chunkForLocality(l: {
  id: string
  name: string
  yoyGrowthPct: number
  demandScore: number
  avgPricePerSqft: number
}): string {
  return (
    `Locality: ${l.name}. Year-on-year price growth: ${l.yoyGrowthPct}%. ` +
    `Demand score: ${l.demandScore}/100. ` +
    `Average price per sqft: ₹${l.avgPricePerSqft.toLocaleString('en-IN')}.`
  )
}

export function chunkForInfra(i: {
  id: string
  name: string
  type: string
  priceImpactPct: number
  sourceUrl: string
}): string {
  return (
    `Infrastructure: ${i.name} (type: ${i.type}). ` +
    `Estimated price impact: ${i.priceImpactPct}%. Source: ${i.sourceUrl}.`
  )
}

// LocationData chunk, category keyword at start of content for better embedding match
export function chunkForLocationData(l: {
  id: string
  category: string
  name: string
  microMarket: string
  notes: string | null
}): string {
  const cat = l.category.toLowerCase()
  const areaLabel = l.microMarket
  const base = `${cat} in ${areaLabel}: ${l.name}. Located in ${areaLabel}.`
  return l.notes ? `${base} ${l.notes}.` : base
}

// Core upsert
export async function upsertEmbedding(
  sourceType: SourceType,
  sourceId: string,
  content: string
): Promise<void> {
  const clean = sanitizeText(content)
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: clean,
  })
  const vector = response.data[0].embedding
  const tokens = countTokens(clean)
  const vectorLiteral = `[${vector.join(',')}]`

  // Raw SQL required, Prisma can't natively model pgvector INSERT
  await prisma.$executeRaw`
    INSERT INTO "Embedding" (id, "sourceType", "sourceId", content, embedding, tokens, "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid()::text,
      ${sourceType},
      ${sourceId},
      ${clean},
      ${vectorLiteral}::vector,
      ${tokens},
      NOW(),
      NOW()
    )
    ON CONFLICT ("sourceType", "sourceId")
    DO UPDATE SET
      embedding = EXCLUDED.embedding,
      content   = EXCLUDED.content,
      tokens    = EXCLUDED.tokens,
      "updatedAt" = NOW()
  `
}
