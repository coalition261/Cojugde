import { NextResponse } from "next/server";
import { processSubmission, RateLimitError, SubmissionSchema } from "@/lib/submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = SubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  try {
    const result = await processSubmission(parsed.data);
    return NextResponse.json({ ...result, reportUrl: `/r/${result.token}` });
  } catch (err) {
    if (err instanceof RateLimitError) return NextResponse.json({ error: err.message }, { status: 429 });
    console.error("submission failed", err);
    return NextResponse.json({ error: "Something went wrong saving your submission. Please retry." }, { status: 500 });
  }
}
