// seed-runner, re-runs the embedding backfill inside the server (imported
// dynamically by src/app/api/admin/seed/route.ts).
import { prisma } from '@/lib/prisma'
import { forEachBatch } from '@/lib/rag/batch'
import {
  upsertEmbedding,
  chunkForProject,
  chunkForBuilder,
  chunkForLocality,
  chunkForInfra,
  chunkForLocationData,
  type BuilderAIContext,
} from '@/lib/rag/embed-writer'

async function embedAndStore(): Promise<{ rows: number; tokens: number }> {
  const totals = { rows: 0, tokens: 0 }

  async function store(sourceType: Parameters<typeof upsertEmbedding>[0], sourceId: string, content: string) {
    totals.tokens += Math.ceil(content.length / 4)
    totals.rows += 1
    await upsertEmbedding(sourceType, sourceId, content)
  }

  await forEachBatch(
    (take, cursor) => prisma.project.findMany({
      take, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: 'asc' },
      select: {
        id: true, projectName: true, builderName: true, microMarket: true, configurations: true,
        minPrice: true, maxPrice: true, possessionDate: true, amenities: true,
        honestConcern: true, analystNote: true, priceNote: true, decisionTag: true,
      },
    }),
    (r) => store('project', r.id, chunkForProject(r))
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
    (b) => store('builder', b.builderName, chunkForBuilder(b as BuilderAIContext))
  )

  await forEachBatch(
    (take, cursor) => prisma.locality.findMany({
      take, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: 'asc' },
      select: { id: true, name: true, yoyGrowthPct: true, demandScore: true, avgPricePerSqft: true },
    }),
    (l) => store('locality', l.id, chunkForLocality(l))
  )

  await forEachBatch(
    (take, cursor) => prisma.infrastructure.findMany({
      take, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: 'asc' },
      select: { id: true, name: true, type: true, priceImpactPct: true, sourceUrl: true },
    }),
    (i) => store('infra', i.id, chunkForInfra(i))
  )

  await forEachBatch(
    (take, cursor) => prisma.locationData.findMany({
      take, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: 'asc' },
      select: { id: true, category: true, name: true, microMarket: true, notes: true },
    }),
    (l) => store('location_data', l.id, chunkForLocationData(l))
  )

  await prisma.$executeRaw`ANALYZE "Embedding"`
  return totals
}

export { embedAndStore }
