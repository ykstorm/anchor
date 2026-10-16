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

  // The whole chunk, word for word, for a record with every optional field set
  // and for one with none. \u20b9 is the rupee sign, \u2013 the range dash.
  it('writes every optional note in order', () => {
    const chunk = chunkForProject({
      id: 'p6',
      projectName: 'Lake View',
      builderName: 'Builder E',
      microMarket: 'East Bank',
      configurations: '3BHK',
      minPrice: 12500000,
      maxPrice: 21000000,
      possessionDate: new Date('2026-12-15'),
      amenities: ['pool', 'gym', 'library'],
      honestConcern: 'Tower C has no OC yet',
      analystNote: 'Priced above the market',
      priceNote: 'GST extra',
      decisionTag: 'wait',
    })
    expect(chunk).toBe(
      'Project: Lake View by Builder E, located in East Bank. ' +
        'Configurations: 3BHK. Price range: \u20b91.3Cr \u2013 \u20b92.1Cr. ' +
        'Possession: Dec 2026. Amenities: pool, gym, library. ' +
        'Honest concern: Tower C has no OC yet ' +
        'Analyst note: Priced above the market ' +
        'Price note: GST extra ' +
        'Decision tag: wait'
    )
  })

  it('drops the price range when only one end is known, and empty notes', () => {
    const chunk = chunkForProject({
      id: 'p7',
      projectName: 'Half Priced',
      builderName: 'Builder F',
      microMarket: 'West End',
      configurations: null,
      minPrice: 4000000,
      maxPrice: 0,
      possessionDate: new Date('2029-03-01'),
      amenities: [],
      honestConcern: '',
      analystNote: null,
      priceNote: null,
      decisionTag: '',
    })
    expect(chunk).toBe(
      'Project: Half Priced by Builder F, located in West End. ' +
        'Configurations: not specified. Possession: Mar 2029. Amenities: not listed.'
    )
  })
})
