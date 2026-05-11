import { describe, it, expect } from 'vitest'

// Pure unit tests for embed-writer chunkForProject logic
// Uses inline copy of the pure formatting logic (no Prisma, no @/ alias)

function chunkForProject(p: {
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
    `Possession: ${possession}.`,
    `Amenities: ${amenityList}.`,
  ]
  if (p.honestConcern) lines.push(`Note: ${p.honestConcern}`)
  if (p.analystNote) lines.push(`Analyst: ${p.analystNote}`)
  if (p.decisionTag) lines.push(`Tag: ${p.decisionTag}`)
  return lines.join(' ')
}

describe('chunkForProject', () => {
  it('formats price range in Cr', () => {
    const chunk = chunkForProject({
      projectName: 'Gala Imperium',
      builderName: 'Gala Developers',
      microMarket: 'Kasarwadi, Pune',
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
    expect(chunk).toContain('Gala Imperium')
    expect(chunk).toContain('Kasarwadi, Pune')
  })

  it('skips price range when minPrice=0', () => {
    const chunk = chunkForProject({
      projectName: 'TBD',
      builderName: 'Unknown',
      microMarket: 'Pune',
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
      projectName: 'Test',
      builderName: 'Test Builder',
      microMarket: 'Pune',
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
      projectName: 'No Amenities',
      builderName: 'Test',
      microMarket: 'Pune',
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
      projectName: 'Clean',
      builderName: 'Test',
      microMarket: 'Pune',
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
    expect(chunk).not.toContain('Note:')
    expect(chunk).not.toContain('Analyst:')
  })
})
