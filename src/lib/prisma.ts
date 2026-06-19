import { PrismaClient } from '@prisma/client'
import { PrismaNeonHttp } from '@prisma/adapter-neon'
import { PrismaPg } from '@prisma/adapter-pg'

const url = process.env.DATABASE_URL ?? ''

// Pick the driver adapter by host:
//   • Neon (serverless HTTP) — used by the live Vercel + Neon deployment.
//   • node-postgres (TCP)    — used for local Docker pgvector and any plain
//                              Postgres, so the README quickstart works on a
//                              clean machine with `docker-compose up -d`.
// The Neon HTTP adapter cannot speak to a local TCP Postgres, so falling back
// to PrismaPg is what makes the local dev story real.
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
