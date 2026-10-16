import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireInternal } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({
  notificationId: z.coerce.number().int().positive(),
  status: z.enum(["sent", "failed"]),
  channel: z.string().max(20).optional(),
});

/** n8n logs delivery of each email back to the notifications table. */
export async function POST(req: Request) {
  const denied = requireInternal(req);
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { notificationId, status, channel } = parsed.data;
  const [row] = await db()
    .update(schema.notifications)
    .set({ status, sentAt: new Date(), ...(channel ? { channel } : {}) })
    .where(eq(schema.notifications.id, notificationId))
    .returning();
  if (!row) return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  await audit("n8n", `email.${status}`, `notification:${notificationId}`, { type: row.type, teamId: row.teamId });
  return NextResponse.json({ ok: true });
}
