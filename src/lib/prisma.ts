import { PrismaClient } from '@prisma/client'
import { PrismaNeonHttp } from '@prisma/adapter-neon'
import { PrismaPg } from '@prisma/adapter-pg'

const url = process.env.DATABASE_URL ?? ''

// Neon URLs use the serverless HTTP adapter; everything else (local Docker
// pgvector, any plain Postgres) uses node-postgres over TCP. The Neon HTTP
// adapter cannot talk to a local TCP Postgres, so this fallback is what makes
// the local dev story work.
const isNeon = /neon\.tech|neon\.build|pooler\.|\.neon\./i.test(url)

function makeAdapter() {
  if (isNeon) return new PrismaNeonHttp(url, {})
  return new PrismaPg({ connectionString: url })
}

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: makeAdapter() })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
