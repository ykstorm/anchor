/**
 * seed-runner — thin wrapper that re-exports backfill logic for the admin seed route.
 * Imported dynamically by src/app/api/admin/seed/route.ts to run inside Vercel.
 */
import { upsertEmbedding } from '@/lib/rag/embed-writer'
import { prisma } from '@/lib/prisma'
import { getEncoding } from 'js-tiktoken'
import type { SourceType } from '@/lib/rag/embed-writer'

const enc = getEncoding('cl100k_base')

function countTokens(text: string): number {
  return enc.encode(text).length
}

function estimateTokens(text: string): number {
  return enc.encode(text).length
}

async function embedAndStore(_corpusPath: string): Promise<{ rows: number; tokens: number }> {
  const BATCH = 50
  const totals = { rows: 0, tokens: 0 }

  async function processBatch<T>(
    sourceType: SourceType,
    rows: T[],
    toContent: (row: T) => string,
    toId: (row: T) => string,
  ) {
    for (const row of rows) {
      const content = toContent(row)
      const tokens = estimateTokens(content)
      totals.rows += 1
      totals.tokens += tokens
      await upsertEmbedding(sourceType, toId(row), content)
    }
  }

  // Projects
  let cursor: string | undefined
  let done = false
  while (!done) {
    const rows = await prisma.project.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true, projectName: true, builderName: true, microMarket: true,
        configurations: true, minPrice: true, maxPrice: true, possessionDate: true,
        amenities: true, honestConcern: true, analystNote: true,
        priceNote: true, decisionTag: true,
      },
    })
    if (rows.length === 0) break
    await processBatch('project', rows, (r) => {
      const hasRupeeBand = r.minPrice > 0 && r.maxPrice > 0
      const priceRange = hasRupeeBand ? `₹${(r.minPrice / 1e7).toFixed(1)}Cr – ₹${(r.maxPrice / 1e7).toFixed(1)}Cr` : null
      const possession = r.possessionDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
      const amenityList = r.amenities.length > 0 ? r.amenities.join(', ') : 'not listed'
      const configLine = priceRange
        ? `Configurations: ${r.configurations ?? 'not specified'}. Price range: ${priceRange}.`
        : `Configurations: ${r.configurations ?? 'not specified'}.`
      const lines = [
        `Project: ${r.projectName} by ${r.builderName}, located in ${r.microMarket}.`,
        configLine,
        `Possession: ${possession}. Amenities: ${amenityList}.`,
      ]
      if (r.honestConcern) lines.push(`Honest concern: ${r.honestConcern}`)
      if (r.analystNote) lines.push(`Analyst note: ${r.analystNote}`)
      if (r.priceNote) lines.push(`Price note: ${r.priceNote}`)
      if (r.decisionTag) lines.push(`Decision tag: ${r.decisionTag}`)
      return lines.join(' ')
    }, (r) => r.id)
    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) done = true
  }

  // Builders
  cursor = undefined; done = false
  while (!done) {
    const rows = await prisma.builder.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, builderName: true, brandName: true, totalTrustScore: true,
        grade: true, deliveryScore: true, reraScore: true, qualityScore: true,
        financialScore: true, responsivenessScore: true },
    })
    if (rows.length === 0) break
    await processBatch('builder', rows, (b) => {
      const brand = b.brandName ?? 'Unknown builder'
      const grade = b.grade ?? 'N/A'
      const total = b.totalTrustScore != null ? `${b.totalTrustScore}/100` : 'N/A'
      const delivery = b.deliveryScore != null ? `${b.deliveryScore}` : 'N/A'
      const rera = b.reraScore != null ? `${b.reraScore}` : 'N/A'
      const quality = b.qualityScore != null ? `${b.qualityScore}` : 'N/A'
      const financial = b.financialScore != null ? `${b.financialScore}` : 'N/A'
      const responsive = b.responsivenessScore != null ? `${b.responsivenessScore}` : 'N/A'
      return `Builder: ${brand}. Trust grade: ${grade}, overall trust score ${total}. Delivery score: ${delivery}, RERA compliance score: ${rera}, construction quality score: ${quality}, financial stability score: ${financial}, responsiveness score: ${responsive}.`
    }, (b) => b.builderName)
    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) done = true
  }

  // Localities
  cursor = undefined; done = false
  while (!done) {
    const rows = await prisma.locality.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, name: true, yoyGrowthPct: true, demandScore: true, avgPricePerSqft: true },
    })
    if (rows.length === 0) break
    await processBatch('locality', rows, (l) =>
      `Locality: ${l.name}. Year-on-year price growth: ${l.yoyGrowthPct}%. Demand score: ${l.demandScore}/100. Average price per sqft: ₹${l.avgPricePerSqft.toLocaleString('en-IN')}.`,
      (r) => r.id)
    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) done = true
  }

  // Infrastructure
  cursor = undefined; done = false
  while (!done) {
    const rows = await prisma.infrastructure.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, name: true, type: true, priceImpactPct: true, sourceUrl: true },
    })
    if (rows.length === 0) break
    await processBatch('infra', rows, (i) =>
      `Infrastructure: ${i.name} (type: ${i.type}). Estimated price impact: ${i.priceImpactPct}%. Source: ${i.sourceUrl}.`,
      (r) => r.id)
    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) done = true
  }

  // Location data
  cursor = undefined; done = false
  while (!done) {
    const rows = await prisma.locationData.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, category: true, name: true, microMarket: true, notes: true },
    })
    if (rows.length === 0) break
    await processBatch('location_data', rows, (l) => {
      const cat = l.category.toLowerCase()
      const areaLabel = l.microMarket === 'SBopal' ? 'South Bopal' : l.microMarket === 'Shela' ? 'Shela' : l.microMarket === 'Bopal' ? 'Bopal' : l.microMarket
      const base = `${cat} in ${areaLabel}: ${l.name}. Located in ${areaLabel} (${l.microMarket}).`
      return l.notes ? `${base} ${l.notes}.` : base
    }, (r) => r.id)
    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) done = true
  }

  await prisma.$executeRawUnsafe(`ANALYZE "Embedding";`)
  await prisma.$disconnect()
  return totals
}

export { embedAndStore }