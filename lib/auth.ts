import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { env } from "./env";
import { SESSION_COOKIE, verifySession, type Session } from "./session";

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  // A valid cookie for a judge that no longer exists counts as signed out.
  const [judge] = await db()
    .select({ role: schema.judges.role })
    .from(schema.judges)
    .where(eq(schema.judges.id, session.judgeId));
  return judge ? { ...session, role: judge.role } : null;
}

type Guard = { session: Session; error?: never } | { session?: never; error: NextResponse };

/** Server-side check for every judge API route. */
export async function requireJudge(): Promise<Guard> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  return { session };
}

export async function requireOrganizer(): Promise<Guard> {
  const g = await requireJudge();
  if (g.error) return g;
  if (g.session.role !== "organizer") {
    return { error: NextResponse.json({ error: "Organizer only" }, { status: 403 }) };
  }
  return g;
}

/** n8n → Next.js calls carry x-internal-key. */
export function requireInternal(req: Request): NextResponse | null {
  const expected = env.internalKey;
  const got = req.headers.get("x-internal-key") ?? "";
  if (!expected) return NextResponse.json({ error: "INTERNAL_KEY not configured" }, { status: 503 });
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
