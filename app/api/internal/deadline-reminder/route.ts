import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireInternal } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { CHECK_LABELS, type CheckKind } from "@/lib/checks/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** n8n WF5 (11:45 AM PKT): teams that still have failing checks, with ready-to-send emails. */
export async function POST(req: Request) {
  const denied = requireInternal(req);
  if (denied) return denied;
  const d = db();
  const rows = await d
    .select({ team: schema.teams, sub: schema.submissions, check: schema.checks })
    .from(schema.checks)
    .innerJoin(schema.submissions, eq(schema.submissions.id, schema.checks.submissionId))
    .innerJoin(schema.teams, eq(schema.teams.id, schema.submissions.teamId))
    .where(eq(schema.checks.status, "fail"));

  const byTeam = new Map<number, { team: typeof schema.teams.$inferSelect; token: string; issues: string[] }>();
  for (const r of rows) {
    const entry = byTeam.get(r.team.id) ?? { team: r.team, token: r.sub.reportToken, issues: [] };
    entry.issues.push(`${CHECK_LABELS[r.check.kind as CheckKind] ?? r.check.kind}: ${r.check.fixTip ?? "see report"}`);
    byTeam.set(r.team.id, entry);
  }

  const emails = [];
  for (const { team, token, issues } of byTeam.values()) {
    const n = issues.length;
    const [row] = await d
      .insert(schema.notifications)
      .values({ teamId: team.id, type: "deadline_reminder", status: "queued", issueKey: "deadline", subject: `1 hour left: ${n} issue${n === 1 ? "" : "s"} still open` })
      .returning();
    emails.push({
      notificationId: row?.id,
      to: team.contactEmail,
      subject: `1 hour left: ${n} issue${n === 1 ? "" : "s"} still open`,
      text: `Hi ${team.name},\n\nThe deadline is in 1 hour and your submission still has ${n} open issue${n === 1 ? "" : "s"}:\n\n${issues.map((i, k) => `${k + 1}. ${i}`).join("\n")}\n\nReport: ${env.appUrl}/r/${token}\n\n— CoJudge`,
    });
  }
  return NextResponse.json({ emails });
}
