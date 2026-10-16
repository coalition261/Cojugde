import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireJudge } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({ verified: z.boolean() });

/** A judge ticks off a human_check (LinkedIn post, Drive video length, ...). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireJudge();
  if (g.error) return g.error;
  const id = Number((await params).id);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const [row] = await db()
    .update(schema.checks)
    .set(parsed.data.verified ? { verifiedBy: g.session.name, verifiedAt: new Date() } : { verifiedBy: null, verifiedAt: null })
    .where(and(eq(schema.checks.id, id), eq(schema.checks.status, "human_check")))
    .returning();
  if (!row) return NextResponse.json({ error: "Only human checks can be ticked off" }, { status: 409 });
  await audit(`judge:${g.session.judgeId}`, parsed.data.verified ? "check.verified" : "check.unverified", `check:${id}`);
  return NextResponse.json({ ok: true });
}
