/**
 * prisma/seed.ts — the canonical seed entrypoint.
 *
 * Run via either:
 *   npx prisma db seed        # uses the "prisma.seed" hook in package.json
 *   npm run seed              # same command, explicit
 *
 * What it does:
 *   1. Seeds the structured corpus (60 rows: 16 projects, 5 builders,
 *      4 localities, 4 infra, 31 location_data POIs) via seedDemoData().
 *      This is enough to demonstrate BOTH retrieval (on-topic real-estate
 *      queries) AND refusal (off-topic queries like "quantum chromodynamics").
 *   2. Embeds every row into the pgvector Embedding table via embedAndStore().
 *      This step calls OpenAI text-embedding-3-small and therefore needs
 *      OPENAI_API_KEY. If the key is absent the structured rows are still
 *      seeded and the embed step is skipped with a clear message, so a
 *      contributor without a key can still stand up the schema + data.
 *
 * Idempotent: re-running upserts rows and re-embeds (unique on
 * (sourceType, sourceId)), so no duplicates are created.
 */
import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { seedDemoData } from '@/lib/rag/demo-seeder'
import { embedAndStore } from '@/lib/rag/seed-runner'

async function main() {
  console.log('[seed] seeding structured corpus…')
  const loaded = await seedDemoData()
  console.log('[seed] structured rows upserted:', loaded)

  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      '[seed] OPENAI_API_KEY not set — skipping embedding step.\n' +
        '[seed] Structured rows are seeded; set OPENAI_API_KEY and re-run ' +
        '`npm run seed` to populate the Embedding (pgvector) table.'
    )
    return
  }

  console.log('[seed] embedding corpus into pgvector (OpenAI text-embedding-3-small)…')
  const embedded = await embedAndStore('./corpus')
  console.log('[seed] embeddings written:', embedded)
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log('[seed] done.')
  })
  .catch(async (err) => {
    console.error('[seed] failed:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
