import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "./db";
import { env } from "./env";
import { checkDeployUrl, safeFetch } from "./checks/url";
import { interpretFetch } from "./checks/deployment";
import { CHECK_LABELS, type CheckKind } from "./checks/types";
import { deliver, describeEvidence, queueUptimeEmail } from "./alerts";
import { smtpConfigured } from "./mailer";
import { audit } from "./audit";

/**
 * Background jobs. Run by the built-in scheduler (lib/scheduler.ts) and also exposed
 * as /api/internal/* routes so n8n can drive them instead if preferred.
 */

const DOWN_AFTER = 2; // consecutive failures before a deployment counts as down

export type UptimeChange = { team: string; change: "down" | "recovered"; evidence: Record<string, unknown>; email: unknown };

/** Re-checks every live deployment. "Down" = 2 consecutive failures; emails on each state change. */
export async function runUptimeSweep() {
  if (Date.now() > env.eventEndsAt.getTime()) {
    return { stopped: true as const, reason: "Event has ended (EVENT_ENDS_AT)", checked: 0, changes: [] as UptimeChange[] };
  }

  const d = db();
  const rows = await d
    .select({ sub: schema.submissions, team: schema.teams, state: schema.deployState })
    .from(schema.submissions)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.submissions.teamId))
    .leftJoin(schema.deployState, eq(schema.deployState.submissionId, schema.submissions.id));

  const changes: UptimeChange[] = [];
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
        // Sent directly over SMTP when configured; otherwise the payload is returned for n8n.
        const email = await queueUptimeEmail(team.id, team.name, team.contactEmail, change, describeEvidence(result.evidence));
        changes.push({ team: team.name, change, evidence: result.evidence, email });
      }
    }),
  );

  return { stopped: false as const, checked, changes };
}

/** One reminder per team that still has failing checks. Never sends a team a second reminder. */
export async function runDeadlineReminder() {
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

  const teamIds = [...byTeam.keys()];
  const already = teamIds.length
    ? await d
        .select({ teamId: schema.notifications.teamId, status: schema.notifications.status })
        .from(schema.notifications)
        .where(and(eq(schema.notifications.type, "deadline_reminder"), inArray(schema.notifications.teamId, teamIds)))
    : [];
  const done = new Set(already.filter((a) => a.status === "sent" || a.status === "queued").map((a) => a.teamId));

  const emails: { notificationId?: number; to: string; subject: string; text: string }[] = [];
  let sent = 0;
  for (const { team, token, issues } of byTeam.values()) {
    if (done.has(team.id)) continue;
    const n = issues.length;
    const subject = `1 hour left: ${n} issue${n === 1 ? "" : "s"} still open`;
    const [row] = await d
      .insert(schema.notifications)
      .values({ teamId: team.id, type: "deadline_reminder", status: "queued", issueKey: "deadline", subject })
      .returning();
    const mail = {
      to: team.contactEmail,
      subject,
      text: `Hi ${team.name},\n\nThe deadline is in 1 hour and your submission still has ${n} open issue${n === 1 ? "" : "s"}:\n\n${issues.map((i, k) => `${k + 1}. ${i}`).join("\n")}\n\nReport: ${env.appUrl}/r/${token}\n\n— CoJudge`,
    };
    if (row && smtpConfigured() && (await deliver(row.id, mail, null)) === "sent") {
      sent += 1;
      continue;
    }
    emails.push({ notificationId: row?.id, ...mail });
  }
  return { teams: byTeam.size, sent, emails };
}
