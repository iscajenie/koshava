import Link from "next/link";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { locale, t } = await getI18n();
  return (
    <div className="card mx-auto max-w-md p-10 text-center">
      <div className="text-5xl font-extrabold text-brand">404</div>
      <p className="mt-2 text-lg font-bold">{t.common.notFound}</p>
      <Link href={`/${locale}`} className="btn-primary mt-6">
        {t.common.toHome}
      </Link>
    </div>
  );
}
