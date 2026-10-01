// Cursor-paginated batch iteration shared by the seed and backfill paths.
//
// `page(take, cursor)` returns up to `take` rows ordered by id ascending;
// `handle` runs once per row. Replaces the copy-pasted while/cursor/done loop
// that previously appeared at every entity type.

export async function forEachBatch<T extends { id: string }>(
  page: (take: number, cursor?: string) => Promise<T[]>,
  handle: (row: T) => Promise<void>,
  take = 50
): Promise<number> {
  let cursor: string | undefined
  let count = 0
  for (;;) {
    const rows = await page(take, cursor)
    if (rows.length === 0) break
    for (const row of rows) {
      await handle(row)
      count += 1
    }
    if (rows.length < take) break
    cursor = rows[rows.length - 1].id
  }
  return count
}
