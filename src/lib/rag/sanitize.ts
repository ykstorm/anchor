// Chunk sanitation applied on both the read path (query text before embedding)
// and the write path (chunk content before embedding and storage).
//
// Strips control characters and zero-width characters, collapses runs of
// whitespace to single spaces, trims, and caps length so a single oversized or
// adversarial input cannot blow up the embedding call or the stored row.

const MAX_LEN = 2000

// C0/C1 control chars except tab/newline/carriage-return, plus DEL.
// eslint-disable-next-line no-control-regex -- stripping control chars is the point
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g

// Zero-width space, ZWNJ, ZWJ, word joiner, BOM/zero-width no-break space.
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g

export function sanitizeText(input: string): string {
  return input
    .replace(CONTROL_CHARS, '')
    .replace(ZERO_WIDTH, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LEN)
}
