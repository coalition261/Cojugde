import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireJudge } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { CRITERIA, computeGap } from "@/lib/rubric";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  submissionId: z.number().int().positive(),
  perCriterion: z.record(z.string(), z.number().min(0)),
  notes: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  const g = await requireJudge();
  if (g.error) return g.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  const { submissionId, perCriterion, notes } = parsed.data;

  const clean: Record<string, number> = {};
  for (const c of CRITERIA) {
    const v = perCriterion[c.key];
    if (v === undefined || v > c.weight) {
      return NextResponse.json({ error: `Score every criterion; ${c.label} is out of ${c.weight}` }, { status: 400 });
    }
    clean[c.key] = Math.round(v * 10) / 10;
  }
  const total = Object.values(clean).reduce((a, b) => a + b, 0);

  const d = db();
  const [sub] = await d.select({ id: schema.submissions.id }).from(schema.submissions).where(eq(schema.submissions.id, submissionId));
  if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const [ev] = await d
    .select()
    .from(schema.evidence)
    .where(eq(schema.evidence.submissionId, submissionId))
    .orderBy(desc(schema.evidence.createdAt))
    .limit(1);
  const gap = ev ? computeGap(clean, ev.estimate) : null;

  const [score] = await d
    .insert(schema.scores)
    .values({ submissionId, judgeId: g.session.judgeId, perCriterion: clean, total, notes, secondLook: gap?.secondLook ?? false })
    .onConflictDoUpdate({
      target: [schema.scores.submissionId, schema.scores.judgeId],
      set: { perCriterion: clean, total, notes, secondLook: gap?.secondLook ?? false, createdAt: new Date() },
    })
    .returning();

  await audit(`judge:${g.session.judgeId}`, "score.saved", `submission:${submissionId}`, { total, secondLook: gap?.secondLook ?? false });

  // Only now — after this judge's score is saved — is the AI estimate revealed.
  return NextResponse.json({ scoreId: score?.id, total, estimate: ev?.estimate ?? null, gap });
}
