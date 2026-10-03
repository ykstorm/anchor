import { describe, it, expect, vi } from 'vitest'

// Import the real chunkForProject from source so these tests catch drift.
// '@/lib/prisma' instantiates a PrismaClient at module load, so stub it.
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { chunkForProject } from '@/lib/rag/embed-writer'

describe('chunkForProject', () => {
  it('formats price range in Cr', () => {
    const chunk = chunkForProject({
      id: 'p1',
      projectName: 'North Court',
      builderName: 'Builder A',
      microMarket: 'North Ridge',
      configurations: '2BHK, 3BHK',
      minPrice: 5000000,
      maxPrice: 7500000,
      possessionDate: new Date('2027-06-01'),
      amenities: ['club house', 'garden'],
      honestConcern: 'Phase 2 delayed',
      analystNote: null,
      priceNote: null,
      decisionTag: 'consider',
    })
    expect(chunk).toContain('0.5Cr')
    expect(chunk).toContain('0.8Cr')
    expect(chunk).toContain('Phase 2 delayed')
    expect(chunk).toContain('North Court')
    expect(chunk).toContain('North Ridge')
  })

  it('skips price range when minPrice=0', () => {
    const chunk = chunkForProject({
      id: 'p2',
      projectName: 'TBD',
      builderName: 'Builder B',
      microMarket: 'North Ridge',
      configurations: '1BHK',
      minPrice: 0,
      maxPrice: 0,
      possessionDate: new Date('2028-01-01'),
      amenities: [],
      honestConcern: null,
      analystNote: null,
      priceNote: null,
      decisionTag: null,
    })
    expect(chunk).not.toContain('₹')
    expect(chunk).not.toContain('Cr')
    expect(chunk).toContain('TBD')
  })

  it('handles null configurations', () => {
    const chunk = chunkForProject({
      id: 'p3',
      projectName: 'Test',
      builderName: 'Builder C',
      microMarket: 'North Ridge',
      configurations: null,
      minPrice: 3000000,
      maxPrice: 4000000,
      possessionDate: new Date('2027-01-01'),
      amenities: [],
      honestConcern: null,
      analystNote: null,
      priceNote: null,
      decisionTag: null,
    })
    expect(chunk).toContain('not specified')
    expect(chunk).toContain('0.3Cr')
  })

  it('handles empty amenities array', () => {
    const chunk = chunkForProject({
      id: 'p4',
      projectName: 'No Amenities',
      builderName: 'Builder D',
      microMarket: 'North Ridge',
      configurations: '1BHK',
      minPrice: 2000000,
      maxPrice: 3000000,
      possessionDate: new Date('2027-01-01'),
      amenities: [],
      honestConcern: null,
      analystNote: null,
      priceNote: null,
      decisionTag: null,
    })
    expect(chunk).toContain('not listed')
  })

  it('skips null honestConcern and analystNote', () => {
    const chunk = chunkForProject({
      id: 'p5',
      projectName: 'Clean',
      builderName: 'Builder D',
      microMarket: 'North Ridge',
      configurations: '1BHK',
      minPrice: 2000000,
      maxPrice: 3000000,
      possessionDate: new Date('2027-01-01'),
      amenities: [],
      honestConcern: null,
      analystNote: null,
      priceNote: null,
      decisionTag: null,
    })
    expect(chunk).not.toContain('Honest concern:')
    expect(chunk).not.toContain('Analyst note:')
  })
})
