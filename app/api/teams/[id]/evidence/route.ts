import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { requireOrganizer } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { checkGithub } from "@/lib/checks/github";
import { generateEvidence } from "@/lib/ai/evidence";
import { openFlags } from "@/lib/alerts";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Organizer-triggered: LLM runs only on demand (quota protection). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireOrganizer();
  if (g.error) return g.error;
  const teamId = Number((await params).id);
  const d = db();
  const [row] = await d
    .select({ team: schema.teams, sub: schema.submissions })
    .from(schema.submissions)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.submissions.teamId))
    .where(eq(schema.teams.id, teamId));
  if (!row) return NextResponse.json({ error: "No submission for this team" }, { status: 404 });

  try {
    const gh = await checkGithub(row.sub.repoUrl, env.freezeAt);
    if (!gh.context) return NextResponse.json({ error: "Repository is not accessible, so there is nothing to read." }, { status: 422 });
    const calibration = await d
      .select({ criterion: schema.calibrationNotes.criterion, note: schema.calibrationNotes.note })
      .from(schema.calibrationNotes)
      .orderBy(desc(schema.calibrationNotes.createdAt))
      .limit(20);
    const result = await generateEvidence({ description: row.sub.description, ctx: gh.context, calibration });
    const [saved] = await d
      .insert(schema.evidence)
      .values({
        submissionId: row.sub.id,
        criteria: result.criteria,
        questions: result.questions,
        redFlags: result.redFlags,
        estimate: result.estimate,
        model: result.model,
      })
      .returning({ id: schema.evidence.id });
    if (result.redFlags.length) {
      await openFlags(row.sub.id, row.team.name, [
        { kind: "manipulation_attempt", detail: `AI agent red flags: ${result.redFlags.slice(0, 3).join("; ")}`.slice(0, 1000) },
      ]);
    }
    await audit(`judge:${g.session.judgeId}`, "evidence.run", `team:${teamId}`, { model: result.model, evidenceId: saved?.id });
    // Never return the estimate here.
    return NextResponse.json({ ok: true, model: result.model, redFlags: result.redFlags.length });
  } catch (err) {
    console.error("evidence failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Evidence generation failed" }, { status: 502 });
  }
}
