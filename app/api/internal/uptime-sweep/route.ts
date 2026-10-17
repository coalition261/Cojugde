import { NextResponse } from "next/server";
import { requireInternal } from "@/lib/auth";
import { runUptimeSweep } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Optional n8n trigger (WF2). The app already runs this sweep itself every 10 minutes
 * (lib/scheduler.ts); changes are emailed directly when SMTP is configured.
 */
export async function POST(req: Request) {
  const denied = requireInternal(req);
  if (denied) return denied;
  return NextResponse.json(await runUptimeSweep());
}
