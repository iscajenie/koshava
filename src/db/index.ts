import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
const client =
  globalForDb.pg ??
  postgres(url, {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: !url.includes(":6543"),
    // Hosted databases (Supabase, Neon) expect TLS; a local server usually has none.
    ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(url) || url.includes("sslmode=disable") ? false : "require",
  });
if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema });
export { schema };
