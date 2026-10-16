import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "./db";
import { env } from "./env";
import { callN8n, N8N_PATHS } from "./n8n";
import { CHECK_LABELS, type CheckKind, type CheckResult, type FlagDraft } from "./checks/types";
import { audit } from "./audit";

const COOLDOWN_MS = 30 * 60 * 1000;
const DAILY_CAP = 10;

export type Email = { to: string; subject: string; text: string };

export function describeEvidence(ev: Record<string, unknown>): string {
  const parts: string[] = [];
  if (ev.statusCode !== undefined) parts.push(`HTTP ${String(ev.statusCode)}`);
  if (ev.durationMs !== undefined) parts.push(`${String(ev.durationMs)} ms`);
  if (ev.result) parts.push(String(ev.result));
  if (ev.reason) parts.push(String(ev.reason));
  if (Array.isArray(ev.hits)) {
    parts.push(
      (ev.hits as { masked?: string; file?: string; line?: number }[])
        .filter((h) => h.masked)
        .map((h) => `${h.masked} at ${h.file}:${h.line}`)
        .join(", "),
    );
  }
  if (Array.isArray(ev.files) && ev.files.length) parts.push(`files: ${(ev.files as string[]).join(", ")}`);
  if (ev.durationSeconds !== undefined) parts.push(`${String(ev.durationSeconds)} s long`);
  return parts.filter(Boolean).join(" · ") || "see report";
}

export function checkFailedEmail(teamName: string, to: string, token: string, failed: CheckResult[]): Email {
  const n = failed.length;
  const lines = failed.map(
    (c, i) =>
      `${i + 1}. ${CHECK_LABELS[c.kind]} — ${describeEvidence(c.evidence)}\n   Fix: ${c.fixTip ?? "See your report."}`,
  );
  return {
    to,
    subject: `CoJudge: ${n} issue${n === 1 ? "" : "s"} in your submission`,
    text: [
      `Hi ${teamName},`,
      "",
      `CoJudge found ${n} issue${n === 1 ? "" : "s"} in your submission:`,
      "",
      ...lines,
      "",
      `Full pre-flight report: ${env.appUrl}/r/${token}`,
      "Fix and resubmit before the deadline. This is an automated factual alert; no judging decision has been made.",
      "",
      "— CoJudge",
    ].join("\n"),
  };
}

export function uptimeEmail(teamName: string, to: string, change: "down" | "recovered", detail: string): Email {
  return change === "down"
    ? {
        to,
        subject: "Your deployment is down",
        text: `Hi ${teamName},\n\nYour deployment failed two checks in a row (${detail}).\nFix: if you see a 502, make PORT in the Source tab match your app (troubleshooting guide, section 01).\n\nWe'll email you again when it's back up.\n\n— CoJudge`,
      }
    : {
        to,
        subject: "Your deployment is back up",
        text: `Hi ${teamName},\n\nGood news: your deployment is responding again (${detail}).\n\n— CoJudge`,
      };
}

/** Enforces the daily cap; the cooldown is applied only to check-failed alerts. */
async function allowed(teamId: number, withCooldown: boolean): Promise<{ ok: boolean; reason?: string }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db()
    .select()
    .from(schema.notifications)
    .where(and(eq(schema.notifications.teamId, teamId), gte(schema.notifications.sentAt, since)))
    .orderBy(desc(schema.notifications.sentAt));
  const sent = recent.filter((r) => r.status === "sent" || r.status === "queued");
  if (sent.length >= DAILY_CAP) return { ok: false, reason: "daily cap" };
  if (withCooldown) {
    const last = sent.find((r) => r.type === "check_failed");
    if (last && Date.now() - last.sentAt.getTime() < COOLDOWN_MS) return { ok: false, reason: "cooldown" };
  }
  return { ok: true };
}

/**
 * One email per issue per state change: only checks that newly moved to `fail`
 * (compared to the previous run) are included.
 */
export async function sendCheckFailedAlert(opts: {
  teamId: number;
  teamName: string;
  email: string;
  token: string;
  results: CheckResult[];
  previous: Map<CheckKind, string>;
}): Promise<"sent" | "none" | "suppressed" | "n8n_unavailable"> {
  const failed = opts.results.filter((r) => r.status === "fail" && opts.previous.get(r.kind) !== "fail");
  if (failed.length === 0) return "none";
  const gate = await allowed(opts.teamId, true);
  const issueKey = failed.map((f) => f.kind).sort().join(",");
  const mail = checkFailedEmail(opts.teamName, opts.email, opts.token, failed);
  const [row] = await db()
    .insert(schema.notifications)
    .values({
      teamId: opts.teamId,
      type: "check_failed",
      status: gate.ok ? "queued" : `suppressed:${gate.reason}`,
      issueKey,
      subject: mail.subject,
    })
    .returning();
  if (!gate.ok || !row) return "suppressed";
  const ok = await callN8n(N8N_PATHS.checkFailed, { notificationId: row.id, teamId: opts.teamId, ...mail });
  if (!ok) await db().update(schema.notifications).set({ status: "n8n_unavailable" }).where(eq(schema.notifications.id, row.id));
  await audit("system", "email.check_failed", `team:${opts.teamId}`, { notificationId: row.id, issueKey, delivered: ok });
  return ok ? "sent" : "n8n_unavailable";
}

export async function queueUptimeEmail(teamId: number, teamName: string, to: string, change: "down" | "recovered", detail: string) {
  const gate = await allowed(teamId, false);
  const mail = uptimeEmail(teamName, to, change, detail);
  const [row] = await db()
    .insert(schema.notifications)
    .values({
      teamId,
      type: change === "down" ? "deploy_down" : "deploy_recovered",
      status: gate.ok ? "queued" : `suppressed:${gate.reason}`,
      issueKey: `deploy:${change}`,
      subject: mail.subject,
    })
    .returning();
  return gate.ok && row ? { notificationId: row.id, teamId, ...mail } : null;
}

/** Opens flags (deduped) and asks n8n to post them to #organizers for Confirm/Dismiss. */
export async function openFlags(submissionId: number, teamName: string, drafts: FlagDraft[]) {
  if (drafts.length === 0) return [];
  const existing = await db().select().from(schema.flags).where(eq(schema.flags.submissionId, submissionId));
  const created = [];
  for (const d of drafts) {
    if (existing.some((f) => f.kind === d.kind && f.detail === d.detail)) continue;
    const [flag] = await db()
      .insert(schema.flags)
      .values({ submissionId, kind: d.kind, detail: d.detail.slice(0, 2000) })
      .returning();
    if (!flag) continue;
    created.push(flag);
    await audit("system", "flag.opened", `flag:${flag.id}`, { kind: d.kind });
    await callN8n(N8N_PATHS.flagOpened, {
      flagId: flag.id,
      team: teamName,
      kind: flag.kind,
      detail: flag.detail,
      dashboardUrl: `${env.appUrl}/dashboard`,
    });
  }
  return created;
}
