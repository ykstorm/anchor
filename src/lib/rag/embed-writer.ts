import OpenAI from 'openai'
import { getEncoding } from 'js-tiktoken'
import { prisma } from '@/lib/prisma'

export type SourceType = 'project' | 'builder' | 'locality' | 'infra' | 'location_data'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const enc = getEncoding('cl100k_base')

function countTokens(text: string): number {
  return enc.encode(text).length
}

// ── Chunk templates ────────────────────────────────────────────────────────────

export function chunkForProject(p: {
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
}): string {
  const hasRupeeBand = p.minPrice > 0 && p.maxPrice > 0
  const priceRange = hasRupeeBand
    ? `₹${(p.minPrice / 1e7).toFixed(1)}Cr – ₹${(p.maxPrice / 1e7).toFixed(1)}Cr`
    : null
  const possession = p.possessionDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
  const amenityList = p.amenities.length > 0 ? p.amenities.join(', ') : 'not listed'
  const configLine = priceRange
    ? `Configurations: ${p.configurations ?? 'not specified'}. Price range: ${priceRange}.`
    : `Configurations: ${p.configurations ?? 'not specified'}.`
  const lines: string[] = [
    `Project: ${p.projectName} by ${p.builderName}, located in ${p.microMarket}.`,
    configLine,
    `Possession: ${possession}. Amenities: ${amenityList}.`,
  ]
  if (p.honestConcern) lines.push(`Honest concern: ${p.honestConcern}`)
  if (p.analystNote) lines.push(`Analyst note: ${p.analystNote}`)
  if (p.priceNote) lines.push(`Price note: ${p.priceNote}`)
  if (p.decisionTag) lines.push(`Decision tag: ${p.decisionTag}`)
  return lines.join(' ')
}

// Compile-time guard — prevents sensitive builder fields from reaching AI context
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

// LocationData chunk — category keyword at start of content for better embedding match
export function chunkForLocationData(l: {
  id: string
  category: string
  name: string
  microMarket: string
  notes: string | null
}): string {
  const cat = l.category.toLowerCase()
  const areaLabel =
    l.microMarket === 'SBopal' ? 'South Bopal' :
    l.microMarket === 'Shela'  ? 'Shela' :
    l.microMarket === 'Bopal'  ? 'Bopal' :
    l.microMarket
  const base = `${cat} in ${areaLabel}: ${l.name}. Located in ${areaLabel} (${l.microMarket}).`
  return l.notes ? `${base} ${l.notes}.` : base
}

// ── Core upsert ───────────────────────────────────────────────────────────────

export async function upsertEmbedding(
  sourceType: SourceType,
  sourceId: string,
  content: string
): Promise<void> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: content,
  })
  const vector = response.data[0].embedding
  const tokens = countTokens(content)
  const vectorLiteral = `[${vector.join(',')}]`

  // Raw SQL required — Prisma can't natively model pgvector INSERT
  await prisma.$executeRaw`
    INSERT INTO "Embedding" (id, "sourceType", "sourceId", content, embedding, tokens, "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid()::text,
      ${sourceType},
      ${sourceId},
      ${content},
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

// ── Per-entity helpers ────────────────────────────────────────────────────────

export async function embedProject(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      projectName: true,
      builderName: true,
      microMarket: true,
      configurations: true,
      minPrice: true,
      maxPrice: true,
      possessionDate: true,
      amenities: true,
      honestConcern: true,
      analystNote: true,
      priceNote: true,
      decisionTag: true,
    },
  })
  if (!project) {
    console.error(`[embed-writer] embedProject: project ${projectId} not found`)
    return
  }
  const content = chunkForProject(project)
  await upsertEmbedding('project', project.id, content)
}

export async function embedBuilder(builderName: string): Promise<void> {
  const builder = await prisma.builder.findUnique({
    where: { builderName },
    select: {
      builderName: true,
      brandName: true,
      totalTrustScore: true,
      grade: true,
      deliveryScore: true,
      reraScore: true,
      qualityScore: true,
      financialScore: true,
      responsivenessScore: true,
      // contactPhone, contactEmail, commissionRatePct, partnerStatus intentionally excluded
    },
  })
  if (!builder) {
    console.error(`[embed-writer] embedBuilder: builder "${builderName}" not found`)
    return
  }
  const ctx: BuilderAIContext = {
    id: builder.id,
    brandName: builder.brandName,
    totalTrustScore: builder.totalTrustScore,
    grade: builder.grade,
    deliveryScore: builder.deliveryScore,
    reraScore: builder.reraScore,
    qualityScore: builder.qualityScore,
    financialScore: builder.financialScore,
    responsivenessScore: builder.responsivenessScore,
  }
  const content = chunkForBuilder(ctx)
  await upsertEmbedding('builder', builder.builderName, content)
}

export async function embedLocationData(id: string): Promise<void> {
  const row = await prisma.locationData.findUnique({
    where: { id },
    select: { id: true, category: true, name: true, microMarket: true, notes: true },
  })
  if (!row) {
    console.error(`[embed-writer] embedLocationData: row ${id} not found`)
    return
  }
  const content = chunkForLocationData(row)
  await upsertEmbedding('location_data', row.id, content)
}

export async function embedLocality(localityId: string): Promise<void> {
  const locality = await prisma.locality.findUnique({
    where: { id: localityId },
    select: {
      id: true,
      name: true,
      yoyGrowthPct: true,
      demandScore: true,
      avgPricePerSqft: true,
    },
  })
  if (!locality) {
    console.error(`[embed-writer] embedLocality: locality ${localityId} not found`)
    return
  }
  const content = chunkForLocality(locality)
  await upsertEmbedding('locality', locality.id, content)
}

export async function embedInfra(infrastructureId: string): Promise<void> {
  const infra = await prisma.infrastructure.findUnique({
    where: { id: infrastructureId },
    select: {
      id: true,
      name: true,
      type: true,
      priceImpactPct: true,
      sourceUrl: true,
    },
  })
  if (!infra) {
    console.error(`[embed-writer] embedInfra: infra ${infrastructureId} not found`)
    return
  }
  const content = chunkForInfra(infra)
  await upsertEmbedding('infra', infra.id, content)
}