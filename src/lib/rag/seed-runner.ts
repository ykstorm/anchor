/**
 * seed-runner — re-runs the embedding backfill logic inside Vercel (server-side).
 * Imported dynamically by src/app/api/admin/seed/route.ts.
 */
import { upsertEmbedding } from '@/lib/rag/embed-writer'
import { prisma } from '@/lib/prisma'
import type { SourceType } from '@/lib/rag/embed-writer'

async function embedAndStore(_corpusPath: string): Promise<{ rows: number; tokens: number }> {
  const BATCH = 50
  const totals = { rows: 0, tokens: 0 }

  // ── Projects ──────────────────────────────────────────────────────────────────
  {
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
      for (const r of rows) {
        const hasRupeeBand = r.minPrice > 0 && r.maxPrice > 0
        const priceRange = hasRupeeBand ? `₹${(r.minPrice / 1e7).toFixed(1)}Cr – ₹${(r.maxPrice / 1e7).toFixed(1)}Cr` : null
        const possession = r.possessionDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
        const amenityList = r.amenities.length > 0 ? r.amenities.join(', ') : 'not listed'
        const configLine = priceRange
          ? `Configurations: ${r.configurations ?? 'not specified'}. Price range: ${priceRange}.`
          : `Configurations: ${r.configurations ?? 'not specified'}.`
        const lines: string[] = [
          `Project: ${r.projectName} by ${r.builderName}, located in ${r.microMarket}.`,
          configLine,
          `Possession: ${possession}. Amenities: ${amenityList}.`,
        ]
        if (r.honestConcern) lines.push(`Honest concern: ${r.honestConcern}`)
        if (r.analystNote) lines.push(`Analyst note: ${r.analystNote}`)
        if (r.priceNote) lines.push(`Price note: ${r.priceNote}`)
        if (r.decisionTag) lines.push(`Decision tag: ${r.decisionTag}`)
        const content = lines.join(' ')
        totals.tokens += Math.ceil(content.length / 4) // rough token estimate
        totals.rows += 1
        await upsertEmbedding('project', r.id, content)
      }
      cursor = rows[rows.length - 1].id
      if (rows.length < BATCH) done = true
    }
  }

  // ── Builders ──────────────────────────────────────────────────────────────────
  {
    let cursor: string | undefined
    let done = false
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
      for (const b of rows) {
        const brand = b.brandName ?? 'Unknown builder'
        const grade = b.grade ?? 'N/A'
        const total = b.totalTrustScore != null ? `${b.totalTrustScore}/100` : 'N/A'
        const content = `Builder: ${brand}. Trust grade: ${grade}, overall trust score ${total}. Delivery score: ${b.deliveryScore ?? 'N/A'}, RERA compliance score: ${b.reraScore ?? 'N/A'}, construction quality score: ${b.qualityScore ?? 'N/A'}, financial stability score: ${b.financialScore ?? 'N/A'}, responsiveness score: ${b.responsivenessScore ?? 'N/A'}.`
        totals.tokens += Math.ceil(content.length / 4)
        totals.rows += 1
        await upsertEmbedding('builder', b.builderName, content)
      }
      cursor = rows[rows.length - 1].id
      if (rows.length < BATCH) done = true
    }
  }

  // ── Localities ────────────────────────────────────────────────────────────────
  {
    let cursor: string | undefined
    let done = false
    while (!done) {
      const rows = await prisma.locality.findMany({
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: { id: true, name: true, yoyGrowthPct: true, demandScore: true, avgPricePerSqft: true },
      })
      if (rows.length === 0) break
      for (const l of rows) {
        const content = `Locality: ${l.name}. Year-on-year price growth: ${l.yoyGrowthPct}%. Demand score: ${l.demandScore}/100. Average price per sqft: ₹${l.avgPricePerSqft.toLocaleString('en-IN')}.`
        totals.tokens += Math.ceil(content.length / 4)
        totals.rows += 1
        await upsertEmbedding('locality', l.id, content)
      }
      cursor = rows[rows.length - 1].id
      if (rows.length < BATCH) done = true
    }
  }

  // ── Infrastructure ────────────────────────────────────────────────────────────
  {
    let cursor: string | undefined
    let done = false
    while (!done) {
      const rows = await prisma.infrastructure.findMany({
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: { id: true, name: true, type: true, priceImpactPct: true, sourceUrl: true },
      })
      if (rows.length === 0) break
      for (const i of rows) {
        const content = `Infrastructure: ${i.name} (type: ${i.type}). Estimated price impact: ${i.priceImpactPct}%. Source: ${i.sourceUrl}.`
        totals.tokens += Math.ceil(content.length / 4)
        totals.rows += 1
        await upsertEmbedding('infra', i.id, content)
      }
      cursor = rows[rows.length - 1].id
      if (rows.length < BATCH) done = true
    }
  }

  // ── Location data ─────────────────────────────────────────────────────────────
  {
    let cursor: string | undefined
    let done = false
    while (!done) {
      const rows = await prisma.locationData.findMany({
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: { id: true, category: true, name: true, microMarket: true, notes: true },
      })
      if (rows.length === 0) break
      for (const l of rows) {
        const cat = l.category.toLowerCase()
        const areaLabel = l.microMarket === 'SBopal' ? 'South Bopal' : l.microMarket === 'Shela' ? 'Shela' : l.microMarket === 'Bopal' ? 'Bopal' : l.microMarket
        const base = `${cat} in ${areaLabel}: ${l.name}. Located in ${areaLabel} (${l.microMarket}).`
        const content = l.notes ? `${base} ${l.notes}.` : base
        totals.tokens += Math.ceil(content.length / 4)
        totals.rows += 1
        await upsertEmbedding('location_data', l.id, content)
      }
      cursor = rows[rows.length - 1].id
      if (rows.length < BATCH) done = true
    }
  }

  await prisma.$executeRawUnsafe(`ANALYZE "Embedding";`)
  await prisma.$disconnect()
  return totals
}

export { embedAndStore }