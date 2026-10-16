import { db, schema } from "./db";

export async function audit(actor: string, action: string, target: string, meta?: Record<string, unknown>) {
  try {
    await db().insert(schema.auditLog).values({ actor, action, target, meta });
  } catch (err) {
    console.error("audit_log write failed", err);
  }
}
