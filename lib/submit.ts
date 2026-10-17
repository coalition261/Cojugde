import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "./db";
import { runChecks } from "./checks";
import type { CheckKind, CheckResult } from "./checks/types";
import { openFlags, sendCheckFailedAlert, sendSubmissionReceived } from "./alerts";
import { audit } from "./audit";

export const SubmissionSchema = z.object({
  teamName: z.string().trim().min(2, "Team name is too short").max(80),
  contactEmail: z.string().trim().email("Enter a valid email"),
  repoUrl: z.string().trim().url("Enter the GitHub repository URL").max(300),
  deployUrl: z.string().trim().url("Enter the deployment URL").max(300),
  videoUrl: z.string().trim().url("Enter the demo video URL").max(300),
  workflowUrl: z.string().trim().url().max(300).optional().or(z.literal("").transform(() => undefined)),
  description: z.string().trim().max(4000).optional(),
});
export type SubmissionPayload = z.infer<typeof SubmissionSchema>;

const RATE_LIMIT_PER_HOUR = 5;
const CACHE_MS = 10 * 60 * 1000;

export class RateLimitError extends Error {}

export async function processSubmission(input: SubmissionPayload) {
  const d = db();
  // Upsert team by name.
  const [team] = await d
    .insert(schema.teams)
    .values({ name: input.teamName, contactEmail: input.contactEmail })
    .onConflictDoUpdate({ target: schema.teams.name, set: { contactEmail: input.contactEmail } })
    .returning();
  if (!team) throw new Error("Could not save team");

  // 5 pre-flight runs per team per hour.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [{ runs } = { runs: 0 }] = await d
    .select({ runs: sql<number>`count(*)::int` })
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.action, "preflight.run"), eq(schema.auditLog.target, `team:${team.id}`), gte(schema.auditLog.at, hourAgo)));
  if (runs >= RATE_LIMIT_PER_HOUR) {
    throw new RateLimitError("Pre-flight is limited to 5 runs per team per hour. Try again later.");
  }

  const [existing] = await d.select().from(schema.submissions).where(eq(schema.submissions.teamId, team.id));
  const sameLinks =
    existing &&
    existing.repoUrl === input.repoUrl &&
    existing.deployUrl === input.deployUrl &&
    existing.videoUrl === input.videoUrl &&
    (existing.workflowUrl ?? undefined) === input.workflowUrl;

  const values = {
    teamId: team.id,
    repoUrl: input.repoUrl,
    deployUrl: input.deployUrl,
    videoUrl: input.videoUrl,
    workflowUrl: input.workflowUrl ?? null,
    description: input.description ?? null,
    submittedAt: new Date(),
  };
  const [sub] = existing
    ? await d.update(schema.submissions).set(values).where(eq(schema.submissions.id, existing.id)).returning()
    : await d.insert(schema.submissions).values({ ...values, reportToken: randomBytes(18).toString("base64url") }).returning();
  if (!sub) throw new Error("Could not save submission");

  const previousChecks = await d.select().from(schema.checks).where(eq(schema.checks.submissionId, sub.id));
  const previous = new Map<CheckKind, string>(previousChecks.map((c) => [c.kind as CheckKind, c.status]));

  // Results cached for 10 minutes when nothing changed.
  const newest = previousChecks.reduce<Date | null>((m, c) => (!m || c.checkedAt > m ? c.checkedAt : m), null);
  if (sameLinks && newest && Date.now() - newest.getTime() < CACHE_MS) {
    return { token: sub.reportToken, cached: true, durationMs: 0, alert: "none" as const };
  }

  await audit(`team:${team.name}`, "preflight.run", `team:${team.id}`);
  const outcome = await runChecks(input);

  await d.transaction(async (tx) => {
    await tx.delete(schema.checks).where(eq(schema.checks.submissionId, sub.id));
    await tx.insert(schema.checks).values(
      outcome.results.map((r: CheckResult) => {
        // Keep a judge's tick on a human_check when it's still a human_check.
        const prev = previousChecks.find((p) => p.kind === r.kind && p.status === "human_check" && r.status === "human_check");
        return {
          submissionId: sub.id,
          kind: r.kind,
          status: r.status,
          evidence: r.evidence,
          fixTip: r.fixTip ?? null,
          verifiedBy: prev?.verifiedBy ?? null,
          verifiedAt: prev?.verifiedAt ?? null,
        };
      }),
    );
    if (outcome.deployLive !== null) {
      await tx
        .insert(schema.deployState)
        .values({ submissionId: sub.id, status: outcome.deployLive ? "up" : "down", failCount: outcome.deployLive ? 0 : 2 })
        .onConflictDoUpdate({
          target: schema.deployState.submissionId,
          set: { status: outcome.deployLive ? "up" : "down", failCount: outcome.deployLive ? 0 : 2, lastChangeAt: new Date() },
        });
    }
  });

  await openFlags(sub.id, team.name, outcome.flags);
  const alert = await sendCheckFailedAlert({
    teamId: team.id,
    teamName: team.name,
    email: team.contactEmail,
    token: sub.reportToken,
    results: outcome.results,
    previous,
  });

  // One email per fresh run: the failure alert if something newly broke, otherwise a confirmation.
  const confirmation =
    alert === "sent"
      ? "skipped"
      : await sendSubmissionReceived({
          teamId: team.id,
          teamName: team.name,
          email: team.contactEmail,
          token: sub.reportToken,
          results: outcome.results,
        });

  return { token: sub.reportToken, cached: false, durationMs: outcome.durationMs, alert, confirmation };
}
