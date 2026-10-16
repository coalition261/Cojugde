import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { hashPasscode, verifyPasscode } from "@/lib/passcode";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/session";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const Body = z.object({ name: z.string().trim().min(2).max(60), passcode: z.string().min(4).max(200) });

/**
 * Passcode login. A judge row whose own hash matches wins; otherwise the shared
 * JUDGE_PASSCODE_HASH / ORGANIZER_PASSCODE_HASH env hashes create the judge on first login.
 */
export async function POST(req: Request) {
  // JSON from the login form, or a plain form post when the page's JavaScript didn't load.
  const isForm = (req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded");
  const raw = isForm ? Object.fromEntries(await req.formData()) : await req.json().catch(() => null);
  const next = isForm && typeof raw?.next === "string" && raw.next.startsWith("/") && !raw.next.startsWith("//") ? raw.next : "/dashboard";
  const fail = (error: string, status: number) =>
    isForm
      ? NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}&next=${encodeURIComponent(next)}`, req.url), 303)
      : NextResponse.json({ error }, { status });

  const parsed = Body.safeParse(raw);
  if (!parsed.success) return fail("Enter your name and passcode", 400);
  const { name, passcode } = parsed.data;

  const d = db();
  const [existing] = await d.select().from(schema.judges).where(eq(schema.judges.name, name));
  let judge: typeof schema.judges.$inferSelect | null | undefined =
    existing && verifyPasscode(passcode, existing.passcodeHash) ? existing : null;

  if (!judge) {
    const orgHash = process.env.ORGANIZER_PASSCODE_HASH;
    const judgeHash = process.env.JUDGE_PASSCODE_HASH;
    const role = orgHash && verifyPasscode(passcode, orgHash) ? "organizer" : judgeHash && verifyPasscode(passcode, judgeHash) ? "judge" : null;
    if (role && !existing) {
      [judge] = await d.insert(schema.judges).values({ name, role, passcodeHash: hashPasscode(passcode) }).returning();
    } else if (role && existing) {
      // Name already taken by someone with a different personal passcode.
      return fail("That name is already used with a different passcode. Sign in with your original passcode or pick another name.", 409);
    }
  }
  if (!judge) {
    await audit(`anon:${name}`, "auth.failed", "login");
    return fail("That passcode doesn't match the judge or organizer passcode. Ask the organizers for it.", 401);
  }

  const token = await signSession({ judgeId: judge.id, name: judge.name, role: judge.role });
  await audit(`judge:${judge.id}`, "auth.login", `judge:${judge.id}`);
  const res = isForm ? NextResponse.redirect(new URL(next, req.url), 303) : NextResponse.json({ ok: true, role: judge.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
