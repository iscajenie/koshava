"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, isAdminEmail } from "@/lib/auth/session";
import { adoptVisitorData } from "@/lib/cart";
import { isLocale, defaultLocale } from "@/i18n/config";

export type AuthState = { error?: "invalidCredentials" | "emailTaken" | "invalidEmail" | "weakPassword" | "tooManyAttempts"; email?: string };

const attempts = new Map<string, { count: number; until: number }>();

function rateLimited(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && entry.until > now && entry.count >= 10) return true;
  if (!entry || entry.until <= now) attempts.set(key, { count: 1, until: now + 10 * 60 * 1000 });
  else entry.count += 1;
  return false;
}

// Only same-site relative paths, so ?next= cannot redirect off the site.
function safeNext(value: FormDataEntryValue | null, locale: string) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith(`/${locale}/`) && !next.startsWith("//") ? next : `/${locale}`;
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export async function register(_: AuthState, form: FormData): Promise<AuthState> {
  const locale = isLocale(String(form.get("locale"))) ? String(form.get("locale")) : defaultLocale;
  const email = String(form.get("email") ?? "");
  const parsed = credentials.safeParse({ email, password: form.get("password") });
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.some((i) => i.path[0] === "email");
    return { error: emailIssue ? "invalidEmail" : "weakPassword", email };
  }
  const name = String(form.get("name") ?? "").trim().slice(0, 100) || null;
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, parsed.data.email))
    .limit(1);
  if (existing) return { error: "emailTaken", email };

  const [user] = await db
    .insert(schema.users)
    .values({
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      name,
      locale,
      role: isAdminEmail(parsed.data.email) ? "admin" : "customer",
    })
    .returning({ id: schema.users.id });
  await adoptVisitorData(user.id);
  await createSession(user.id);
  redirect(safeNext(form.get("next"), locale));
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const locale = isLocale(String(form.get("locale"))) ? String(form.get("locale")) : defaultLocale;
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (rateLimited(email)) return { error: "tooManyAttempts", email };

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "invalidCredentials", email };
  }
  // Admin access follows ADMIN_EMAILS, so it can be granted or revoked without touching the database.
  const role = isAdminEmail(email) ? "admin" : "customer";
  if (role !== user.role) await db.update(schema.users).set({ role }).where(eq(schema.users.id, user.id));
  attempts.delete(email);
  await adoptVisitorData(user.id);
  await createSession(user.id);
  redirect(safeNext(form.get("next"), locale));
}

export async function logout(form: FormData) {
  const locale = String(form.get("locale"));
  await destroySession();
  redirect(`/${isLocale(locale) ? locale : defaultLocale}`);
}
