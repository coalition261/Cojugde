import { NextResponse } from "next/server";
import { eq, ilike } from "drizzle-orm";
import { requireInternal } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { getLeaderboard } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only data behind the n8n MCP tools. Never includes AI estimates or contact emails. */
async function teamReport(name: string) {
  const d = db();
  const [row] = await d
    .select({ team: schema.teams, sub: schema.submissions })
    .from(schema.teams)
    .leftJoin(schema.submissions, eq(schema.submissions.teamId, schema.teams.id))
    .where(ilike(schema.teams.name, name));
  if (!row) return null;
  if (!row.sub) return { team: row.team.name, submitted: false };
  const [checks, flags, scores] = await Promise.all([
    d.select().from(schema.checks).where(eq(schema.checks.submissionId, row.sub.id)),
    d.select().from(schema.flags).where(eq(schema.flags.submissionId, row.sub.id)),
    d.select({ total: schema.scores.total }).from(schema.scores).where(eq(schema.scores.submissionId, row.sub.id)),
  ]);
  return {
    team: row.team.name,
    shortlisted: row.team.shortlisted,
    submittedAt: row.sub.submittedAt,
    links: { repo: row.sub.repoUrl, deploy: row.sub.deployUrl, video: row.sub.videoUrl },
    checks: checks.map((c) => ({ kind: c.kind, status: c.status, fixTip: c.fixTip, verified: !!c.verifiedAt })),
    flags: flags.map((f) => ({ id: f.id, kind: f.kind, status: f.status, detail: f.detail })),
    humanScores: { judges: scores.length, average: scores.length ? scores.reduce((a, s) => a + s.total, 0) / scores.length : null },
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ tool: string }> }) {
  const denied = requireInternal(req);
  if (denied) return denied;
  const { tool } = await params;
  const q = new URL(req.url).searchParams;

  switch (tool) {
    case "get_team_report": {
      const team = q.get("team")?.trim();
      if (!team) return NextResponse.json({ error: "team is required" }, { status: 400 });
      const report = await teamReport(team);
      return report ? NextResponse.json(report) : NextResponse.json({ error: `No team named ${team}` }, { status: 404 });
    }
    case "list_open_flags": {
      const rows = await db()
        .select({ flag: schema.flags, team: schema.teams.name })
        .from(schema.flags)
        .innerJoin(schema.submissions, eq(schema.submissions.id, schema.flags.submissionId))
        .innerJoin(schema.teams, eq(schema.teams.id, schema.submissions.teamId))
        .where(eq(schema.flags.status, "open"));
      return NextResponse.json({
        openFlags: rows.map((r) => ({ id: r.flag.id, team: r.team, kind: r.flag.kind, detail: r.flag.detail, openedAt: r.flag.createdAt })),
      });
    }
    case "get_leaderboard":
      return NextResponse.json({ note: "Human scores only", leaderboard: await getLeaderboard() });
    case "compare_teams": {
      const a = q.get("a")?.trim();
      const b = q.get("b")?.trim();
      if (!a || !b) return NextResponse.json({ error: "a and b are required" }, { status: 400 });
      const [ra, rb] = await Promise.all([teamReport(a), teamReport(b)]);
      return NextResponse.json({ a: ra, b: rb });
    }
    default:
      return NextResponse.json({ error: `Unknown tool ${tool}` }, { status: 404 });
  }
}
