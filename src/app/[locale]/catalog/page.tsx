import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { CatalogView } from "@/components/catalog-view";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.catalog.title };
}

export default async function CatalogPage({ searchParams }: PageProps<"/[locale]/catalog">) {
  const { locale, t } = await getI18n();
  return <CatalogView locale={locale} t={t} searchParams={await searchParams} />;
}
