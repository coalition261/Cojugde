import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const SHORTLIST_SIZE = 10;
const Body = z.object({ shortlisted: z.boolean() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireOrganizer();
  if (g.error) return g.error;
  const teamId = Number((await params).id);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const d = db();
  if (parsed.data.shortlisted) {
    const [{ n } = { n: 0 }] = await d
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.teams)
      .where(eq(schema.teams.shortlisted, true));
    if (n >= SHORTLIST_SIZE) return NextResponse.json({ error: "The shortlist already has 10 teams" }, { status: 409 });
  }
  await d.update(schema.teams).set({ shortlisted: parsed.data.shortlisted }).where(eq(schema.teams.id, teamId));
  await audit(`judge:${g.session.judgeId}`, parsed.data.shortlisted ? "shortlist.add" : "shortlist.remove", `team:${teamId}`);
  return NextResponse.json({ ok: true });
}
