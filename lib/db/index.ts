import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __cojudgePool?: Pool; __cojudgeDb?: DB };

/** Errors that mean the socket died before/while talking to Postgres, not that the SQL was wrong. */
export function isConnectionError(err: unknown): boolean {
  const e = err as { message?: string; code?: string; cause?: unknown } | undefined;
  if (!e) return false;
  const msg = e.message ?? "";
  if (/Connection terminated|connection timeout|Client has encountered a connection error/i.test(msg)) return true;
  if (e.code && ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "57P01"].includes(e.code)) return true;
  return e.cause ? isConnectionError(e.cause) : false;
}

function createPool(url: string): Pool {
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    // Hosted Postgres is reached through a forwarded port that silently drops idle TCP
    // connections, so keep sockets alive and recycle idle ones quickly.
    keepAlive: true,
    keepAliveInitialDelayMillis: 5_000,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 20_000,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  // A dropped idle connection must not crash the server; the pool replaces it on the next query.
  pool.on("error", (err) => console.warn("[db] idle client error:", err.message));

  // Retry a single (non-transaction) query once when its connection was dropped.
  const rawQuery = pool.query.bind(pool) as (...args: unknown[]) => unknown;
  pool.query = ((...args: unknown[]) => {
    if (typeof args[args.length - 1] === "function") return rawQuery(...args);
    return (rawQuery(...args) as Promise<unknown>).catch((err: unknown) => {
      if (!isConnectionError(err)) throw err;
      console.warn("[db] retrying query after connection error:", (err as Error).message);
      return rawQuery(...args);
    });
  }) as typeof pool.query;
  return pool;
}

function create(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  globalForDb.__cojudgePool ??= createPool(url);
  return drizzle(globalForDb.__cojudgePool, { schema });
}

/** Lazily created so `next build` works without a database. */
export function db(): DB {
  globalForDb.__cojudgeDb ??= create();
  return globalForDb.__cojudgeDb;
}

export { schema };
