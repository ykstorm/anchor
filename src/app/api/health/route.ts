import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Liveness + DB readiness. Probes the database with a trivial SELECT so a broken
// connection surfaces as 503 rather than a false "ok".
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json(
      { ok: false, db: false },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
