import Link from "next/link";
import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata = { robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const { locale, t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/admin`);
  if (user.role !== "admin") {
    return <div className="card p-10 text-center text-lg font-bold">{t.admin.noAccess}</div>;
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-4 text-2xl font-extrabold tracking-tight">{t.admin.title}</h1>
        <Link href={`/${locale}/admin`} className="btn-secondary px-3 py-1.5 text-sm">
          {t.admin.orders}
        </Link>
        <Link href={`/${locale}/admin/catalog`} className="btn-secondary px-3 py-1.5 text-sm">
          {t.admin.catalog}
        </Link>
      </div>
      {children}
    </div>
  );
}
