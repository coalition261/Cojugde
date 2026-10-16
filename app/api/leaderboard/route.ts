import { NextResponse } from "next/server";
import { requireJudge } from "@/lib/auth";
import { getLeaderboard } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Averages of human scores only. ?format=csv for export. */
export async function GET(req: Request) {
  const g = await requireJudge();
  if (g.error) return g.error;
  const rows = await getLeaderboard();
  if (new URL(req.url).searchParams.get("format") === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["rank", "team", "average", "judges", "shortlisted", "confirmed_flags"].join(","),
      ...rows.map((r, i) => [i + 1, esc(r.name), r.average ?? "", r.judges, r.shortlisted, r.confirmedFlags].join(",")),
    ].join("\n");
    return new NextResponse(csv, {
      headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="cojudge-leaderboard.csv"' },
    });
  }
  return NextResponse.json({ leaderboard: rows });
}
