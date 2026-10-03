/**
 * Backfill script, embeds all projects, builders, localities, infra, and
 * location rows.
 *
 * Usage:
 *   npm run embed:backfill          # live run
 *   npm run embed:backfill -- --dry # count rows + estimate tokens only
 *
 * Safe to rerun, upsertEmbedding is idempotent via @@unique(sourceType, sourceId).
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { forEachBatch } from '@/lib/rag/batch'
import {
  upsertEmbedding,
  chunkForProject,
  chunkForBuilder,
  chunkForLocality,
  chunkForInfra,
  chunkForLocationData,
  type SourceType,
  type BuilderAIContext,
} from '@/lib/rag/embed-writer'
import { getEncoding } from 'js-tiktoken'

const isDry = process.argv.includes('--dry')
const enc = getEncoding('cl100k_base')
const totals = { rows: 0, tokens: 0 }

async function embed(sourceType: SourceType, sourceId: string, content: string) {
  totals.rows += 1
  totals.tokens += enc.encode(content).length
  if (!isDry) await upsertEmbedding(sourceType, sourceId, content)
}

async function main() {
  console.log(isDry ? '[backfill] DRY RUN, no OpenAI calls will be made' : '[backfill] LIVE RUN')

  await forEachBatch(
    (take, cursor) => prisma.project.findMany({
      take, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: 'asc' },
      select: {
        id: true, projectName: true, builderName: true, microMarket: true, configurations: true,
        minPrice: true, maxPrice: true, possessionDate: true, amenities: true,
        honestConcern: true, analystNote: true, priceNote: true, decisionTag: true,
      },
    }),
    (r) => embed('project', r.id, chunkForProject(r))
  )

  await forEachBatch(
    (take, cursor) => prisma.builder.findMany({
      take, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: 'asc' },
      select: {
        id: true, builderName: true, brandName: true, totalTrustScore: true, grade: true,
        deliveryScore: true, reraScore: true, qualityScore: true, financialScore: true,
        responsivenessScore: true,
      },
    }),
    (b) => embed('builder', b.builderName, chunkForBuilder(b as BuilderAIContext))
  )

  await forEachBatch(
    (take, cursor) => prisma.locality.findMany({
      take, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: 'asc' },
      select: { id: true, name: true, yoyGrowthPct: true, demandScore: true, avgPricePerSqft: true },
    }),
    (l) => embed('locality', l.id, chunkForLocality(l))
  )

  await forEachBatch(
    (take, cursor) => prisma.infrastructure.findMany({
      take, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: 'asc' },
      select: { id: true, name: true, type: true, priceImpactPct: true, sourceUrl: true },
    }),
    (i) => embed('infra', i.id, chunkForInfra(i))
  )

  await forEachBatch(
    (take, cursor) => prisma.locationData.findMany({
      take, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: 'asc' },
      select: { id: true, category: true, name: true, microMarket: true, notes: true },
    }),
    (l) => embed('location_data', l.id, chunkForLocationData(l))
  )

  if (isDry) {
    const costUsd = (totals.tokens / 1_000_000) * 0.02
    console.log('[backfill] DRY RUN complete.')
    console.log(`  Total rows:   ${totals.rows}`)
    console.log(`  Total tokens: ${totals.tokens.toLocaleString()}`)
    console.log(`  Est. cost:    $${costUsd.toFixed(6)} (text-embedding-3-small @ $0.02/1M)`)
  } else {
    console.log(`[backfill] Embedded ${totals.rows} rows (${totals.tokens.toLocaleString()} tokens).`)
    console.log('[backfill] Running ANALYZE on Embedding table...')
    await prisma.$executeRaw`ANALYZE "Embedding"`
    console.log('[backfill] Done.')
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('[backfill] Fatal error:', err)
  process.exit(1)
})
