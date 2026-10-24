import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.loginTitle };
}

export default async function Page({ searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await getI18n();
  const next = (await searchParams).next;
  const nextPath = typeof next === "string" && next.startsWith(`/${locale}/`) ? next : undefined;
  if (await getCurrentUser()) redirect(nextPath ?? `/${locale}/account`);
  return <AuthForm mode="login" next={nextPath} />;
}
