import { NextResponse } from "next/server";
import { requireJudge } from "@/lib/auth";
import { getTeamDetail } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireJudge();
  if (g.error) return g.error;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  // Estimate is omitted until this judge has scored (enforced in getTeamDetail).
  const detail = await getTeamDetail(id, g.session.judgeId);
  if (!detail) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  return NextResponse.json(detail, { headers: { "cache-control": "no-store" } });
}
