// Seed entrypoint (npm run seed, or the prisma.seed hook). Replaces the corpus
// with the 60-row demo set, then embeds it into pgvector. Rows outside the demo
// set are deleted, and so are chunks whose source was not embedded in this run.
// The embed step needs OPENAI_API_KEY; without it the rows are still seeded and
// the embed step is skipped. Safe to run again: a second run leaves the same rows.
import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { seedDemoData } from '@/lib/rag/demo-seeder'
import { embedAndStore } from '@/lib/rag/seed-runner'

async function main() {
  console.log('[seed] seeding structured corpus…')
  await seedDemoData()

  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      '[seed] OPENAI_API_KEY not set, skipping embedding step.\n' +
        '[seed] Structured rows are seeded; set OPENAI_API_KEY and re-run ' +
        '`npm run seed` to populate the Embedding (pgvector) table.'
    )
    return
  }

  console.log('[seed] embedding corpus into pgvector (OpenAI text-embedding-3-small)…')
  await embedAndStore()
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
