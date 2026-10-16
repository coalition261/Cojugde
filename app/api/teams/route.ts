import { NextResponse } from "next/server";
import { requireJudge } from "@/lib/auth";
import { getTeamsOverview } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireJudge();
  if (g.error) return g.error;
  return NextResponse.json({ teams: await getTeamsOverview(g.session.judgeId) });
}
