import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "./db";
import { CRITERIA } from "./rubric";
import type { CheckStatus } from "./checks/types";

const { teams, submissions, checks, flags, scores, evidence, judges } = schema;

export type TeamRow = {
  id: number;
  name: string;
  shortlisted: boolean;
  submittedAt: Date | null;
  submissionId: number | null;
  counts: Record<CheckStatus, number>;
  completeness: number;
  openFlags: number;
  confirmedFlags: number;
  scoredByMe: boolean;
  scoreCount: number;
  hasEvidence: boolean;
};

export async function getTeamsOverview(judgeId: number): Promise<TeamRow[]> {
  const rows = await db()
    .select({ team: teams, sub: submissions })
    .from(teams)
    .leftJoin(submissions, eq(submissions.teamId, teams.id))
    .orderBy(asc(teams.name));
  const subIds = rows.map((r) => r.sub?.id).filter((x): x is number => typeof x === "number");
  const [allChecks, allFlags, allScores, allEvidence] = subIds.length
    ? await Promise.all([
        db().select({ s: checks.submissionId, status: checks.status, verifiedAt: checks.verifiedAt }).from(checks).where(inArray(checks.submissionId, subIds)),
        db().select({ s: flags.submissionId, status: flags.status }).from(flags).where(inArray(flags.submissionId, subIds)),
        db().select({ s: scores.submissionId, judgeId: scores.judgeId }).from(scores).where(inArray(scores.submissionId, subIds)),
        db().select({ s: evidence.submissionId }).from(evidence).where(inArray(evidence.submissionId, subIds)),
      ])
    : [[], [], [], []];

  return rows.map(({ team, sub }) => {
    const mine = sub ? allChecks.filter((c) => c.s === sub.id) : [];
    const counts = { pass: 0, fail: 0, warn: 0, human_check: 0 } as Record<CheckStatus, number>;
    for (const c of mine) counts[c.status] += 1;
    const resolved = mine.filter((c) => c.status === "pass" || (c.status === "human_check" && c.verifiedAt)).length;
    const teamFlags = sub ? allFlags.filter((f) => f.s === sub.id) : [];
    const teamScores = sub ? allScores.filter((s) => s.s === sub.id) : [];
    return {
      id: team.id,
      name: team.name,
      shortlisted: team.shortlisted,
      submittedAt: sub?.submittedAt ?? null,
      submissionId: sub?.id ?? null,
      counts,
      completeness: mine.length ? Math.round((resolved / mine.length) * 100) : 0,
      openFlags: teamFlags.filter((f) => f.status === "open").length,
      confirmedFlags: teamFlags.filter((f) => f.status === "confirmed").length,
      scoredByMe: teamScores.some((s) => s.judgeId === judgeId),
      scoreCount: teamScores.length,
      hasEvidence: sub ? allEvidence.some((e) => e.s === sub.id) : false,
    };
  });
}

/**
 * Blind-first scoring is enforced here: the AI estimate is only included
 * once *this* judge has saved a score for the submission.
 */
export async function getTeamDetail(teamId: number, judgeId: number) {
  const [row] = await db()
    .select({ team: teams, sub: submissions })
    .from(teams)
    .leftJoin(submissions, eq(submissions.teamId, teams.id))
    .where(eq(teams.id, teamId));
  if (!row) return null;
  const { team, sub } = row;
  if (!sub) return { team: publicTeam(team), submission: null, checks: [], flags: [], evidence: null, myScore: null, estimate: null };

  const [teamChecks, teamFlags, [ev], [myScore]] = await Promise.all([
    db().select().from(checks).where(eq(checks.submissionId, sub.id)).orderBy(asc(checks.id)),
    db().select().from(flags).where(eq(flags.submissionId, sub.id)).orderBy(desc(flags.createdAt)),
    db().select().from(evidence).where(eq(evidence.submissionId, sub.id)).orderBy(desc(evidence.createdAt)).limit(1),
    db().select().from(scores).where(and(eq(scores.submissionId, sub.id), eq(scores.judgeId, judgeId))),
  ]);

  return {
    team: publicTeam(team),
    submission: {
      id: sub.id,
      repoUrl: sub.repoUrl,
      deployUrl: sub.deployUrl,
      videoUrl: sub.videoUrl,
      workflowUrl: sub.workflowUrl,
      description: sub.description,
      submittedAt: sub.submittedAt,
    },
    checks: teamChecks,
    flags: teamFlags,
    evidence: ev
      ? { id: ev.id, criteria: ev.criteria, questions: ev.questions, redFlags: ev.redFlags, model: ev.model, createdAt: ev.createdAt }
      : null,
    myScore: myScore ?? null,
    // Server-enforced: omitted until this judge has scored.
    estimate: myScore && ev ? ev.estimate : null,
  };
}
export type TeamDetail = NonNullable<Awaited<ReturnType<typeof getTeamDetail>>>;

function publicTeam(t: typeof teams.$inferSelect) {
  // contact_email stays server-side; judges don't need it.
  return { id: t.id, name: t.name, shortlisted: t.shortlisted };
}

/** Leaderboard uses human scores only. */
export async function getLeaderboard() {
  const rows = await db()
    .select({ teamId: teams.id, name: teams.name, shortlisted: teams.shortlisted, subId: submissions.id })
    .from(teams)
    .leftJoin(submissions, eq(submissions.teamId, teams.id));
  const allScores = await db().select({ s: scores.submissionId, total: scores.total, per: scores.perCriterion }).from(scores);
  const allFlags = await db().select({ s: flags.submissionId, status: flags.status }).from(flags);
  return rows
    .map((r) => {
      const mine = allScores.filter((s) => s.s === r.subId);
      const avg = mine.length ? mine.reduce((a, s) => a + s.total, 0) / mine.length : null;
      const perCriterion = Object.fromEntries(
        CRITERIA.map((c) => [c.key, mine.length ? mine.reduce((a, s) => a + (s.per[c.key] ?? 0), 0) / mine.length : null]),
      );
      return {
        teamId: r.teamId,
        name: r.name,
        shortlisted: r.shortlisted,
        judges: mine.length,
        average: avg === null ? null : Math.round(avg * 10) / 10,
        perCriterion,
        confirmedFlags: allFlags.filter((f) => f.s === r.subId && f.status === "confirmed").length,
        openFlags: allFlags.filter((f) => f.s === r.subId && f.status === "open").length,
      };
    })
    .sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
}

export async function getReportByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [row] = await db()
    .select({ team: teams, sub: submissions })
    .from(submissions)
    .innerJoin(teams, eq(teams.id, submissions.teamId))
    .where(eq(submissions.reportToken, token));
  if (!row) return null;
  const list = await db().select().from(checks).where(eq(checks.submissionId, row.sub.id)).orderBy(asc(checks.id));
  return {
    team: row.team.name,
    submittedAt: row.sub.submittedAt,
    links: { repo: row.sub.repoUrl, deploy: row.sub.deployUrl, video: row.sub.videoUrl, workflow: row.sub.workflowUrl },
    checks: list.map((c) => ({ id: c.id, kind: c.kind, status: c.status, evidence: c.evidence, fixTip: c.fixTip, checkedAt: c.checkedAt })),
  };
}

export async function listJudges() {
  return db().select({ id: judges.id, name: judges.name, role: judges.role }).from(judges);
}
