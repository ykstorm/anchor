import { describe, it, expect, vi } from 'vitest'

// Mock side-effecting deps so importing the real retriever module is safe:
//  - '@/lib/prisma' instantiates a PrismaClient at module load (needs a DB URL)
//  - 'openai' would try to construct a client
// We only exercise the pure detectAmenityCategories logic here, but importing
// the REAL function from source is what makes this test catch regressions
// (previously it copy-pasted the regex map, so source drift went undetected).
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('openai', () => ({ default: class {} }))

import { detectAmenityCategories } from '@/lib/rag/retriever'

describe('detectAmenityCategories (imported from source)', () => {
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
