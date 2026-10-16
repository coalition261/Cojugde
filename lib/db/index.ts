import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __cojudgePool?: Pool; __cojudgeDb?: DB };

function create(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool =
    globalForDb.__cojudgePool ??
    new Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      // Release idle connections so a restarted server or a small local DB isn't left with stale sockets.
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
  // A dropped idle connection must not crash the server; the pool replaces it on the next query.
  if (!globalForDb.__cojudgePool) pool.on("error", (err) => console.warn("[db] idle client error:", err.message));
  globalForDb.__cojudgePool = pool;
  return drizzle(pool, { schema });
}

/** Lazily created so `next build` works without a database. */
export function db(): DB {
  globalForDb.__cojudgeDb ??= create();
  return globalForDb.__cojudgeDb;
}

export { schema };
