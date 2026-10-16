import { jwtVerify, SignJWT } from "jose";

/** Edge-safe session helpers (used by middleware and server code). */
export const SESSION_COOKIE = "cj_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type Session = { judgeId: number; name: string; role: "judge" | "organizer" };

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ name: s.name, role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(s.judgeId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .setIssuer("cojudge")
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: "cojudge", algorithms: ["HS256"] });
    const judgeId = Number(payload.sub);
    const role = payload.role === "organizer" ? "organizer" : "judge";
    if (!Number.isInteger(judgeId) || typeof payload.name !== "string") return null;
    return { judgeId, name: payload.name, role };
  } catch {
    return null;
  }
}
