import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "./db";
import { audit } from "./audit";

/** Only an organizer's decision changes a flag; each decision is logged with who and when. */
export async function decideFlag(flagId: number, decision: "confirmed" | "dismissed", decidedBy: string) {
  const [flag] = await db()
    .update(schema.flags)
    .set({ status: decision, decidedBy, decidedAt: new Date() })
    .where(and(eq(schema.flags.id, flagId), eq(schema.flags.status, "open")))
    .returning();
  if (flag) await audit(decidedBy, `flag.${decision}`, `flag:${flagId}`, { kind: flag.kind });
  return flag ?? null;
}
