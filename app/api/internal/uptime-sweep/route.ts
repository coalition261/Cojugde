import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireInternal } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { checkDeployUrl, safeFetch } from "@/lib/checks/url";
import { interpretFetch } from "@/lib/checks/deployment";
import { describeEvidence, queueUptimeEmail } from "@/lib/alerts";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DOWN_AFTER = 2; // consecutive failures

/** Called by n8n WF2 every 10 minutes. Returns state changes; n8n sends the emails. */
export async function POST(req: Request) {
  const denied = requireInternal(req);
  if (denied) return denied;
  if (Date.now() > env.eventEndsAt.getTime()) {
    return NextResponse.json({ stopped: true, reason: "Event has ended (EVENT_ENDS_AT)", changes: [] });
  }

  const d = db();
  const rows = await d
    .select({ sub: schema.submissions, team: schema.teams, state: schema.deployState })
    .from(schema.submissions)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.submissions.teamId))
    .leftJoin(schema.deployState, eq(schema.deployState.submissionId, schema.submissions.id));

  const changes: unknown[] = [];
  let checked = 0;

  await Promise.all(
    rows.map(async ({ sub, team, state }) => {
      const verdict = checkDeployUrl(sub.deployUrl);
      if (!verdict.ok) return; // allowlisted hosts only
      checked += 1;
      const result = interpretFetch(await safeFetch(verdict.url));
      const ok = result.status === "pass";
      const prevStatus = state?.status ?? "up";
      const failCount = ok ? 0 : (state?.failCount ?? 0) + 1;
      let status = prevStatus;
      let change: "down" | "recovered" | null = null;
      if (ok && prevStatus === "down") {
        status = "up";
        change = "recovered";
      } else if (!ok && prevStatus === "up" && failCount >= DOWN_AFTER) {
        status = "down";
        change = "down";
      }

      await d
        .insert(schema.deployState)
        .values({ submissionId: sub.id, status, failCount })
        .onConflictDoUpdate({
          target: schema.deployState.submissionId,
          set: { status, failCount, ...(change ? { lastChangeAt: new Date() } : {}) },
        });
      // Keep the pre-flight report current.
      await d
        .update(schema.checks)
        .set({ status: result.status, evidence: result.evidence, fixTip: result.fixTip ?? null, checkedAt: new Date() })
        .where(and(eq(schema.checks.submissionId, sub.id), eq(schema.checks.kind, "deployment_live")));

      if (change) {
        await audit("system", `uptime.${change}`, `team:${team.id}`, result.evidence);
        const email = await queueUptimeEmail(team.id, team.name, team.contactEmail, change, describeEvidence(result.evidence));
        changes.push({ team: team.name, change, evidence: result.evidence, email });
      }
    }),
  );

  return NextResponse.json({ stopped: false, checked, changes });
}
