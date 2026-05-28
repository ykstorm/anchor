import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Server liveness check — DB & embedder tested via E2E smoke steps
  return NextResponse.json({ ok: true });
}