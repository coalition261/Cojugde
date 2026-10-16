import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth";
import { decideFlag } from "@/lib/flags";

export const runtime = "nodejs";

const Body = z.object({ decision: z.enum(["confirmed", "dismissed"]) });

/** Dashboard alternative to the Discord Confirm/Dismiss buttons. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireOrganizer();
  if (g.error) return g.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  const flag = await decideFlag(Number((await params).id), parsed.data.decision, `organizer:${g.session.name}`);
  if (!flag) return NextResponse.json({ error: "Flag not found or already decided" }, { status: 409 });
  return NextResponse.json({ ok: true, flag });
}
