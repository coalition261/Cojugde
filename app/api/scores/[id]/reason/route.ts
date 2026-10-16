import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireJudge } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { computeGap } from "@/lib/rubric";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({ reason: z.string().trim().min(5, "Write a one-line reason").max(500) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireJudge();
  if (g.error) return g.error;
  const id = Number((await params).id);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid reason" }, { status: 400 });

  const d = db();
  const [score] = await d
    .select()
    .from(schema.scores)
    .where(and(eq(schema.scores.id, id), eq(schema.scores.judgeId, g.session.judgeId)));
  if (!score) return NextResponse.json({ error: "Score not found" }, { status: 404 });

  await d.update(schema.scores).set({ reason: parsed.data.reason }).where(eq(schema.scores.id, id));

  // Calibration notes (F10): reasons feed the agent prompt for later teams.
  const [ev] = await d
    .select()
    .from(schema.evidence)
    .where(eq(schema.evidence.submissionId, score.submissionId))
    .orderBy(desc(schema.evidence.createdAt))
    .limit(1);
  if (ev) {
    const gap = computeGap(score.perCriterion, ev.estimate);
    const big = gap.perCriterion.filter((c) => c.big);
    const targets = big.length ? big : [{ key: "overall", human: 0, ai: 0, gap: gap.totalGap, big: true }];
    await d.insert(schema.calibrationNotes).values(
      targets.map((c) => ({
        criterion: c.key,
        note: `Judges scored ${c.key === "overall" ? "the total" : c.key} ${c.human > c.ai ? "higher" : "lower"} than the AI: ${parsed.data.reason}`.slice(0, 600),
      })),
    );
  }
  await audit(`judge:${g.session.judgeId}`, "score.reason", `score:${id}`);
  return NextResponse.json({ ok: true });
}
