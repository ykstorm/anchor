import { describe, it, expect } from 'vitest'
import { sanitizeText } from '@/lib/rag/sanitize'

describe('sanitizeText', () => {
  it('strips control characters', () => {
    expect(sanitizeText('a\u0000b\u0007c\u001Fd')).toBe('abcd')
  })

  it('strips zero-width characters', () => {
    const zw = 'he' + String.fromCharCode(0x200B) + 'll' + String.fromCharCode(0x200D) + 'o' + String.fromCharCode(0xFEFF)
    expect(sanitizeText(zw)).toBe('hello')
  })

  it('collapses runs of whitespace to single spaces', () => {
    expect(sanitizeText('a   b\t\tc\n\nd')).toBe('a b c d')
  })

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeText('   padded   ')).toBe('padded')
  })

  it('caps length at 2000 characters', () => {
    const out = sanitizeText('x'.repeat(5000))
    expect(out.length).toBe(2000)
  })

  it('leaves ordinary text unchanged', () => {
    expect(sanitizeText('Which projects are ready to move in?')).toBe(
      'Which projects are ready to move in?'
    )
  })
})
