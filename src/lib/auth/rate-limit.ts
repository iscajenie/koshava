import "server-only";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db, schema } from "@/db";

const WINDOW_MS = 10 * 60 * 1000;

/** The visitor's address as the hosting platform reports it (Vercel sets x-real-ip itself). */
export async function clientIp() {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

/**
 * True when `key` has reached `limit` attempts in the last ten minutes. Counted in the database, because every
 * serverless instance has its own memory. If the count cannot be read, the attempt is allowed: sign-in must not
 * break with the limiter.
 */
export async function tooManyAttempts(key: string, limit: number) {
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.authAttempts)
      .where(and(eq(schema.authAttempts.key, key), gt(schema.authAttempts.createdAt, new Date(Date.now() - WINDOW_MS))));
    return row.n >= limit;
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return false;
  }
}

export async function recordAttempt(...keys: string[]) {
  try {
    await db.insert(schema.authAttempts).values(keys.map((key) => ({ key })));
    // Old rows are of no use; one in fifty writes sweeps them.
    if (Math.random() < 0.02) await db.delete(schema.authAttempts).where(lt(schema.authAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
  } catch (error) {
    console.error("Rate limit record failed:", error);
  }
}

export async function clearAttempts(key: string) {
  try {
    await db.delete(schema.authAttempts).where(eq(schema.authAttempts.key, key));
  } catch (error) {
    console.error("Rate limit reset failed:", error);
  }
}
