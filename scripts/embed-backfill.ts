/**
 * Backfill script — embeds all projects, builders, localities, and infra rows.
 *
 * Usage:
 *   npm run embed:backfill          # live run
 *   npm run embed:backfill -- --dry # count rows + estimate tokens only
 *
 * Safe to rerun — upsertEmbedding is idempotent via @@unique(sourceType, sourceId).
 */

import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import {
  upsertEmbedding,
  chunkForProject,
  chunkForBuilder,
  chunkForLocality,
  chunkForInfra,
  chunkForLocationData,
  type SourceType,
} from '@/lib/rag/embed-writer'
import { getEncoding } from 'js-tiktoken'
import type { BuilderAIContext } from '@/lib/rag/embed-writer'

const isDry = process.argv.includes('--dry')
const BATCH = 50

const enc = getEncoding('cl100k_base')

function estimateTokens(text: string): number {
  return enc.encode(text).length
}

async function processBatch<T>(
  sourceType: SourceType,
  rows: T[],
  toContent: (row: T) => string,
  toId: (row: T) => string,
  dryTotals: { rows: number; tokens: number }
) {
  for (const row of rows) {
    const content = toContent(row)
    const tokens = estimateTokens(content)
    dryTotals.rows += 1
    dryTotals.tokens += tokens
    if (!isDry) {
      await upsertEmbedding(sourceType, toId(row), content)
    }
  }
}

async function backfillProjects(totals: { rows: number; tokens: number }) {
  let cursor: string | undefined
  let done = false
  while (!done) {
    const rows = await prisma.project.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
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
    if (rows.length === 0) break
    await processBatch('project', rows, chunkForProject, (r) => r.id, totals)
    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) done = true
  }
}

async function backfillBuilders(totals: { rows: number; tokens: number }) {
  let cursor: string | undefined
  let done = false
  while (!done) {
    const rows = await prisma.builder.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        builderName: true,
        brandName: true,
        totalTrustScore: true,
        grade: true,
        deliveryScore: true,
        reraScore: true,
        qualityScore: true,
        financialScore: true,
        responsivenessScore: true,
      },
    })
    if (rows.length === 0) break
    await processBatch(
      'builder',
      rows,
      (b) => {
        const ctx: BuilderAIContext = {
          brandName: b.brandName,
          totalTrustScore: b.totalTrustScore,
          grade: b.grade,
          deliveryScore: b.deliveryScore,
          reraScore: b.reraScore,
          qualityScore: b.qualityScore,
          financialScore: b.financialScore,
          responsivenessScore: b.responsivenessScore,
        }
        return chunkForBuilder(ctx)
      },
      (b) => b.builderName,
      totals
    )
    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) done = true
  }
}

async function backfillLocalities(totals: { rows: number; tokens: number }) {
  let cursor: string | undefined
  let done = false
  while (!done) {
    const rows = await prisma.locality.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        yoyGrowthPct: true,
        demandScore: true,
        avgPricePerSqft: true,
      },
    })
    if (rows.length === 0) break
    await processBatch('locality', rows, chunkForLocality, (r) => r.id, totals)
    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) done = true
  }
}

async function backfillInfra(totals: { rows: number; tokens: number }) {
  let cursor: string | undefined
  let done = false
  while (!done) {
    const rows = await prisma.infrastructure.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        priceImpactPct: true,
        sourceUrl: true,
      },
    })
    if (rows.length === 0) break
    await processBatch('infra', rows, chunkForInfra, (r) => r.id, totals)
    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) done = true
  }
}

async function backfillLocationData(totals: { rows: number; tokens: number }) {
  let cursor: string | undefined
  let done = false
  while (!done) {
    const rows = await prisma.locationData.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        category: true,
        name: true,
        microMarket: true,
        notes: true,
      },
    })
    if (rows.length === 0) break
    await processBatch('location_data', rows, chunkForLocationData, (r) => r.id, totals)
    cursor = rows[rows.length - 1].id
    if (rows.length < BATCH) done = true
  }
}

async function main() {
  console.log(isDry ? '[backfill] DRY RUN — no OpenAI calls will be made' : '[backfill] LIVE RUN')

  const totals = { rows: 0, tokens: 0 }

  console.log('[backfill] Processing projects...')
  await backfillProjects(totals)

  console.log('[backfill] Processing builders...')
  await backfillBuilders(totals)

  console.log('[backfill] Processing localities...')
  await backfillLocalities(totals)

  console.log('[backfill] Processing infrastructure...')
  await backfillInfra(totals)

  console.log('[backfill] Processing location_data...')
  await backfillLocationData(totals)

  if (isDry) {
    const costUsd = (totals.tokens / 1_000_000) * 0.02
    console.log(`[backfill] DRY RUN complete.`)
    console.log(`  Total rows:   ${totals.rows}`)
    console.log(`  Total tokens: ${totals.tokens.toLocaleString()}`)
    console.log(`  Est. cost:    $${costUsd.toFixed(6)} (text-embedding-3-small @ $0.02/1M)`)
  } else {
    console.log(`[backfill] Embedded ${totals.rows} rows (${totals.tokens.toLocaleString()} tokens).`)
    console.log('[backfill] Running ANALYZE on Embedding table...')
    await prisma.$executeRawUnsafe(`ANALYZE "Embedding";`)
    console.log('[backfill] Done.')
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('[backfill] Fatal error:', err)
  process.exit(1)
})