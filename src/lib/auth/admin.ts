import "server-only";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getCurrentUser } from "./session";

/**
 * Every admin page calls this itself: the admin layout's check is not enough, because a request can ask the
 * server for a page's payload without its layout.
 */
export async function requireAdminPage(locale: Locale) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/admin`);
  if (user.role !== "admin") notFound();
  return user;
}
