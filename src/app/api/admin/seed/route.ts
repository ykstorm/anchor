import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!process.env.SEED_TOKEN || req.headers.get('x-seed-token') !== process.env.SEED_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const { seedDemoData } = await import('@/lib/rag/demo-seeder')
    const { embedAndStore } = await import('@/lib/rag/seed-runner')
    const loaded = await seedDemoData()
    const embedded = await embedAndStore()
    return NextResponse.json({ ok: true, loaded, embedded })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e), stack: e?.stack?.split('\n').slice(0, 8).join('\n') }, { status: 500 })
  }
}
