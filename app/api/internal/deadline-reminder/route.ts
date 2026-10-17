import { NextResponse } from "next/server";
import { requireInternal } from "@/lib/auth";
import { runDeadlineReminder } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Optional n8n trigger (WF5). The app already sends the reminder itself at
 * DEADLINE_REMINDER_AT (lib/scheduler.ts); a team never gets it twice.
 */
export async function POST(req: Request) {
  const denied = requireInternal(req);
  if (denied) return denied;
  const { emails } = await runDeadlineReminder();
  return NextResponse.json({ emails });
}
