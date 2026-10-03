// Seed entrypoint (npm run seed, or the prisma.seed hook). Seeds the 60-row
// demo corpus, then embeds it into pgvector. The embed step needs OPENAI_API_KEY;
// without it the rows are still seeded and the embed step is skipped. Idempotent:
// rows upsert and re-embed on the (sourceType, sourceId) unique key.
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
      '[seed] OPENAI_API_KEY not set, skipping embedding step.\n' +
        '[seed] Structured rows are seeded; set OPENAI_API_KEY and re-run ' +
        '`npm run seed` to populate the Embedding (pgvector) table.'
    )
    return
  }

  console.log('[seed] embedding corpus into pgvector (OpenAI text-embedding-3-small)…')
  const embedded = await embedAndStore()
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
