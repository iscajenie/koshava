import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const VISITOR_COOKIE = "ks_vid";

/** Anonymous visitor id that owns a guest cart and favorites. */
export async function getVisitorId() {
  return (await cookies()).get(VISITOR_COOKIE)?.value ?? null;
}

/** Returns the visitor id, creating the cookie if needed. Call only from Server Actions. */
export async function ensureVisitorId() {
  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;
  if (existing) return existing;
  const id = randomUUID();
  jar.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.SESSION_SECURE !== "false" && process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return id;
}
