import { describe, it, expect, vi, beforeEach } from 'vitest'

// The seed replaces the corpus: it writes the current sources, then deletes
// what it did not write. These tests run the real seeder and seed runner
// against a stubbed Prisma client, so no database and no OpenAI call is used.

type Call = { sql: string; values: unknown[] }

const { prismaStub, upsertEmbedding, rawCalls } = vi.hoisted(() => {
  const rawCalls: Call[] = []
  const record = (strings: TemplateStringsArray, values: unknown[]) => {
    rawCalls.push({ sql: strings.join('?'), values })
  }
  let nextId = 0
  const withId = async () => ({ id: `row-${++nextId}` })
  return {
    rawCalls,
    upsertEmbedding: vi.fn(async () => {}),
    prismaStub: {
      $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        record(strings, values)
        return [{ projects: 2, builders: 1, localities: 0, infrastructure: 0, locationData: 3 }]
      }),
      $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        record(strings, values)
        return strings.join('?').includes('DELETE') ? 4 : 0
      }),
      builder: {
        upsert: vi.fn(withId),
        findMany: vi.fn(async () => [
          { id: 'b1', builderName: 'Builder A', brandName: 'Builder A', totalTrustScore: 81, grade: 'A',
            deliveryScore: 23, reraScore: 14, qualityScore: 19, financialScore: 13, responsivenessScore: 12 },
        ]),
      },
      locality: {
        upsert: vi.fn(withId),
        findMany: vi.fn(async () => [
          { id: 'l1', name: 'North Ridge', yoyGrowthPct: 9.2, demandScore: 86, avgPricePerSqft: 5400 },
        ]),
      },
      infrastructure: {
        upsert: vi.fn(withId),
        findMany: vi.fn(async () => [
          { id: 'i1', name: 'Metro Line 2', type: 'metro', priceImpactPct: 18, sourceUrl: 'https://example.com/metro' },
        ]),
      },
      project: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(withId),
        update: vi.fn(withId),
        findMany: vi.fn(async () => [
          { id: 'p1', projectName: 'North Court', builderName: 'Builder A', microMarket: 'North Ridge',
            configurations: '3BHK', minPrice: 0, maxPrice: 0, possessionDate: new Date('2026-06-30'),
            amenities: [], honestConcern: null, analystNote: null, priceNote: null, decisionTag: null },
        ]),
      },
      locationData: {
        upsert: vi.fn(withId),
        findMany: vi.fn(async () => [
          { id: 'd1', category: 'park', name: 'Central Park', microMarket: 'North Ridge', notes: null },
        ]),
      },
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaStub }))
vi.mock('@/lib/rag/embed-writer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rag/embed-writer')>()),
  upsertEmbedding,
}))

import { seedDemoData } from '@/lib/rag/demo-seeder'
import { embedAndStore } from '@/lib/rag/seed-runner'

const deletes = (table: string) => rawCalls.filter((c) => c.sql.includes(`DELETE FROM "${table}"`))

beforeEach(() => {
  rawCalls.length = 0
  upsertEmbedding.mockClear()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('embedAndStore', () => {
  it('deletes chunks whose source it did not write, in one statement after every upsert', async () => {
    const result = await embedAndStore()

    expect(upsertEmbedding).toHaveBeenCalledTimes(5)
    const [del] = deletes('Embedding')
    expect(deletes('Embedding')).toHaveLength(1)
    // The kept set is passed as two parallel arrays: source types and source ids.
    expect(del.values).toEqual([
      ['project', 'builder', 'locality', 'infra', 'location_data'],
      ['p1', 'Builder A', 'l1', 'i1', 'd1'],
    ])
    const lastUpsert = Math.max(...upsertEmbedding.mock.invocationCallOrder)
    const deleteCall = prismaStub.$executeRaw.mock.invocationCallOrder[
      prismaStub.$executeRaw.mock.calls.findIndex((c) => (c[0] as TemplateStringsArray).join('?').includes('DELETE'))
    ]
    expect(deleteCall).toBeGreaterThan(lastUpsert)

    expect(result).toMatchObject({ rows: 5, removed: 4 })
    expect(console.log).toHaveBeenCalledWith('[seed] embeddings written:', 5, 'stale removed:', 4)
  })

  it('deletes nothing when an upsert fails, so a failed run never empties the corpus', async () => {
    upsertEmbedding.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('openai down'))
    await expect(embedAndStore()).rejects.toThrow('openai down')
    expect(deletes('Embedding')).toHaveLength(0)
  })
})

describe('seedDemoData', () => {
  it('removes corpus rows outside the demo set in one statement after the upserts', async () => {
    const loaded = await seedDemoData()

    const tables = ['Project', 'Builder', 'Locality', 'Infrastructure', 'LocationData']
    const statements = rawCalls.filter((c) => tables.some((t) => c.sql.includes(`DELETE FROM "${t}"`)))
    expect(statements).toHaveLength(1)
    for (const t of tables) expect(statements[0].sql).toContain(`DELETE FROM "${t}"`)

    // Each table keeps exactly the ids the seeder just wrote, in table order.
    const [projects, builders, localities, infrastructure, locationData] = statements[0].values as string[][]
    expect(projects).toHaveLength(16)
    expect(builders).toHaveLength(5)
    expect(localities).toHaveLength(4)
    expect(infrastructure).toHaveLength(4)
    expect(locationData).toHaveLength(31)
    const written = [
      ...prismaStub.project.create.mock.results,
      ...prismaStub.builder.upsert.mock.results,
    ].map((r) => r.value)
    const writtenIds = (await Promise.all(written)).map((r) => (r as { id: string }).id)
    expect([...projects, ...builders].sort()).toEqual(writtenIds.sort())

    expect(loaded).toMatchObject({
      projects: 16,
      builders: 5,
      removed: { projects: 2, builders: 1, localities: 0, infrastructure: 0, locationData: 3 },
    })
  })
})
