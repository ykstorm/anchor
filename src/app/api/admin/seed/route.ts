import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (req.headers.get('x-seed-token') !== process.env.SEED_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // Spawn the existing seed script in-process via tsx isn't available on Vercel,
  // so import the project's lib directly and re-run the logic
  try {
    const { embedAndStore } = await import('@/lib/rag/seed-runner');
    const result = await embedAndStore('./corpus');
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e), stack: e?.stack }, { status: 500 });
  }
}
