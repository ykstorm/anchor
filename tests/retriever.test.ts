import { describe, it, expect } from 'vitest'

// Pure unit tests for RAG retriever logic — no Prisma, no @/ alias needed
// These mirror the detectAmenityCategories logic from src/lib/rag/embed-writer.ts

const AMENITY_CATEGORIES: Record<string, RegExp> = {
  park:      /\b(park|parks|garden|gardens)\b/i,
  hospital:  /\b(hospital|hospitals|clinic|clinics|healthcare)\b/i,
  atm:       /\b(atm|atms|cash\s*machine)\b/i,
  bank:      /\b(bank|banks|branch|branches)\b/i,
  school:    /\b(school|schools|college|colleges|university|universities|institute)\b/i,
  mall:      /\b(mall|malls|shopping|shop|store|supermarket)\b/i,
  club:      /\b(club|clubs|gym|gyms|sports|fitness)\b/i,
  temple:    /\b(temple|temples|mandir)\b/i,
  transport: /\b(metro|brts|bus|transport|station|commute)\b/i,
}

function detectAmenityCategories(query: string): string[] {
  const hit: string[] = []
  for (const [cat, rx] of Object.entries(AMENITY_CATEGORIES)) {
    if (rx.test(query)) hit.push(cat)
  }
  if (hit.includes('atm') && !hit.includes('bank')) hit.push('bank')
  if (hit.includes('bank') && !hit.includes('atm')) hit.push('atm')
  return hit
}

describe('detectAmenityCategories', () => {
  it('detects park/garden', () => {
    const cats = detectAmenityCategories('flat near park and garden')
    expect(cats).toContain('park')
  })

  it('detects hospital from hospital|hospitals pattern', () => {
    const cats = detectAmenityCategories('need hospital nearby for parents')
    expect(cats).toContain('hospital')
  })

  it('atm implies bank (cross-population)', () => {
    const cats = detectAmenityCategories('atm wala area')
    expect(cats).toContain('atm')
    expect(cats).toContain('bank') // cross-populated from atm
  })

  it('bank implies atm', () => {
    const cats = detectAmenityCategories('bank nearby')
    expect(cats).toContain('bank')
    expect(cats).toContain('atm')
  })

  it('detects school from school|schools pattern', () => {
    const cats = detectAmenityCategories('good schools and colleges')
    expect(cats).toContain('school')
  })

  it('detects metro from metro|brts|bus pattern', () => {
    const cats = detectAmenityCategories('metro connectivity important')
    expect(cats).toContain('transport')
  })

  it('detects temple/mandir', () => {
    const cats = detectAmenityCategories('temple ke paas')
    expect(cats).toContain('temple')
  })

  it('detects club|gym|sports|fitness as club category', () => {
    const cats = detectAmenityCategories('gym and club in society')
    expect(cats).toContain('club')
  })

  it('returns empty for no matches', () => {
    const cats = detectAmenityCategories('just browsing')
    expect(cats).toHaveLength(0)
  })

  it('handles empty query', () => {
    const cats = detectAmenityCategories('')
    expect(cats).toHaveLength(0)
  })
})
