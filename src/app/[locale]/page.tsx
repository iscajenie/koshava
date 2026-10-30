import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getI18n } from "@/i18n/server";
import { fmt, plural } from "@/i18n";
import { getCategoryRows, getSaleProducts, listCategories, SALE_CATEGORY_SLUG } from "@/lib/catalog";
import { ProductRow } from "@/components/product-row";
import { CatalogView } from "@/components/catalog-view";
import { CatalogToolbar } from "@/components/catalog-toolbar";

type Search = { [key: string]: string | string[] | undefined };

// Sorting, the sale filter, a search or a page number turn the front page into the grid of all products.
const listing = (search: Search) => ["q", "sort", "sale", "page"].some((key) => search[key]);

export async function generateMetadata({ searchParams }: PageProps<"/[locale]">): Promise<Metadata> {
  const { t } = await getI18n();
  const search = await searchParams;
  const q = [search.q].flat()[0]?.trim();
  if (q) return { title: fmt(t.catalog.searchTitle, { q }) };
  return listing(search) ? { title: t.catalog.all } : {};
}

/**
 * The front page and the catalog in one, after Everli's store: a banner, the filter chips and a sideways row of
 * products for the sale and every category; with a sort, the sale filter or a search, the grid of all products.
 */
export default async function HomePage({ searchParams }: PageProps<"/[locale]">) {
  const { locale, t } = await getI18n();
  const search = await searchParams;
  if (listing(search)) return <CatalogView locale={locale} t={t} searchParams={search} />;

  const [categories, sale, rows] = await Promise.all([listCategories(locale), getSaleProducts(20), getCategoryRows(12)]);
  const total = categories.filter((c) => !c.isSale).reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-10">
      <div>
        <section className="relative overflow-hidden rounded-lg bg-store px-6 py-7 text-white md:px-10 md:py-9">
          <div className="absolute -top-20 -right-10 h-64 w-64 rounded-full bg-[#fff000]" aria-hidden />
          <div className="absolute -right-4 -bottom-24 h-44 w-44 rounded-full border-[16px] border-[#e60a14]" aria-hidden />
          <div className="relative max-w-xl">
            <h1 className="font-display text-2xl leading-tight font-semibold md:text-[32px] md:leading-10">{t.home.heroTitle}</h1>
            <p className="mt-2 text-white/85">{t.home.heroText}</p>
          </div>
        </section>
        <Suspense>
          <CatalogToolbar countLabel={plural(t.catalog.items, total, locale)} />
        </Suspense>

        {/* Phones have no sidebar: the categories are a row of tiles here. */}
        {categories.length > 0 && (
          <nav aria-label={t.nav.catalog} className="lg:hidden">
            <ul className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4">
              {categories.map((c) => (
                <li key={c.slug} className="w-20 shrink-0">
                  <Link href={`/${locale}/catalog/${c.slug}`} className="flex flex-col items-center gap-1.5 text-center">
                    <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface p-2">
                      {c.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image} alt="" loading="lazy" className="h-full w-full object-contain" />
                      )}
                    </span>
                    <span className={`text-xs leading-tight font-medium ${c.isSale ? "text-sale" : ""}`}>{c.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      {sale.length > 0 && (
        <ProductRow title={t.home.onSale} href={`/${locale}/catalog/${SALE_CATEGORY_SLUG}`} linkLabel={t.home.showAll} products={sale} />
      )}
      {categories
        .filter((c) => !c.isSale && rows.get(c.id)?.length)
        .map((c) => (
          <ProductRow key={c.slug} title={c.name} href={`/${locale}/catalog/${c.slug}`} linkLabel={t.home.showAll} products={rows.get(c.id)!} />
        ))}
    </div>
  );
}
