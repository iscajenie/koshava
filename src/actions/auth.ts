"use server";

import { and, eq, lt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, isAdminEmail } from "@/lib/auth/session";
import { clearAttempts, clientIp, recordAttempt, tooManyAttempts } from "@/lib/auth/rate-limit";
import { adoptVisitorData } from "@/lib/cart";
import { isLocale, defaultLocale } from "@/i18n/config";

export type AuthState = { error?: "invalidCredentials" | "emailTaken" | "invalidEmail" | "weakPassword" | "tooManyAttempts"; email?: string };

// Attempts per ten minutes: wrong passwords for one email, wrong passwords from one address, new accounts from one address.
const LOGIN_PER_EMAIL = 10;
const LOGIN_PER_IP = 50;
const REGISTER_PER_IP = 30;

// Compared against when the email is unknown, so the answer takes as long as for a wrong password.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8vY6Qm6mF3Hk1hQ5u0fN0Zp0hV3k7W";

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
  const ipKey = `register:${await clientIp()}`;
  if (await tooManyAttempts(ipKey, REGISTER_PER_IP)) return { error: "tooManyAttempts", email };
  await recordAttempt(ipKey);
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
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 320);
  const password = String(form.get("password") ?? "").slice(0, 200);
  const emailKey = `login:${email}`;
  const ipKey = `login-ip:${await clientIp()}`;
  if ((await tooManyAttempts(emailKey, LOGIN_PER_EMAIL)) || (await tooManyAttempts(ipKey, LOGIN_PER_IP))) {
    return { error: "tooManyAttempts", email };
  }

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    await recordAttempt(emailKey, ipKey);
    return { error: "invalidCredentials", email };
  }
  // Admin access follows ADMIN_EMAILS, so it can be granted or revoked without touching the database.
  const role = isAdminEmail(email) ? "admin" : "customer";
  if (role !== user.role) await db.update(schema.users).set({ role }).where(eq(schema.users.id, user.id));
  await clearAttempts(emailKey);
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, user.id), lt(schema.sessions.expiresAt, new Date())));
  await adoptVisitorData(user.id);
  await createSession(user.id);
  redirect(safeNext(form.get("next"), locale));
}

export async function logout(form: FormData) {
  const locale = String(form.get("locale"));
  await destroySession();
  redirect(`/${isLocale(locale) ? locale : defaultLocale}`);
}
