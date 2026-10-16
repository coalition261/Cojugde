import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternal } from "@/lib/auth";
import { decideFlag } from "@/lib/flags";

export const runtime = "nodejs";

const Body = z.object({
  flagId: z.coerce.number().int().positive(),
  decision: z.string().transform((s) => s.toLowerCase()),
  decidedBy: z.string().max(100).default("discord:organizer"),
});

/** n8n WF3 posts the organizer's Discord Confirm/Dismiss here. */
export async function POST(req: Request) {
  const denied = requireInternal(req);
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { flagId, decision, decidedBy } = parsed.data;
  // Discord approval returns approved=true/false; map it to our two states.
  const normalized = ["confirm", "confirmed", "approve", "approved", "true"].includes(decision)
    ? "confirmed"
    : ["dismiss", "dismissed", "disapprove", "disapproved", "false"].includes(decision)
      ? "dismissed"
      : null;
  if (!normalized) return NextResponse.json({ error: "decision must be confirm or dismiss" }, { status: 400 });
  const flag = await decideFlag(flagId, normalized, decidedBy);
  if (!flag) return NextResponse.json({ error: "Flag not found or already decided" }, { status: 409 });
  return NextResponse.json({ ok: true, flag: { id: flag.id, status: flag.status } });
}
