import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { getCategory } from "@/lib/catalog";
import { CatalogView } from "@/components/catalog-view";

export async function generateMetadata({ params }: PageProps<"/[locale]/catalog/[category]">): Promise<Metadata> {
  const { locale } = await getI18n();
  const category = await getCategory((await params).category, locale);
  return { title: category?.name };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/[locale]/catalog/[category]">) {
  const { locale, t } = await getI18n();
  const category = await getCategory((await params).category, locale);
  if (!category) notFound();
  return <CatalogView locale={locale} t={t} category={category} searchParams={await searchParams} />;
}
