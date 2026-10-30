import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getI18n } from "@/i18n/server";
import { fmt, plural } from "@/i18n";
import { shop } from "@/config/shop";
import { formatPrice } from "@/lib/money";
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
  const rate = `${Math.round(shop.deliveryFeeRate * 100)}%`;
  const min = formatPrice(shop.minOrderMinor, locale);

  return (
    <div className="space-y-10">
      <div>
        {/* At most 90 px high: columns as wide as the banner allows (it narrows with the sidebar), on phones two rows. */}
        <section className="@container relative overflow-hidden rounded-lg bg-store text-white">
          {/* The logo's colours as decoration, where there is room for them beside the text. */}
          <div className="absolute -top-12 -right-6 hidden size-28 rounded-full bg-[#fff000] @min-[1040px]:block" aria-hidden />
          <div className="absolute right-20 -bottom-10 hidden size-16 rounded-full border-[9px] border-[#e60a14] @min-[1040px]:block" aria-hidden />
          <div className="relative flex flex-col gap-1.5 px-4 py-3 @min-[672px]:flex-row @min-[672px]:items-center @min-[672px]:gap-6 @min-[672px]:px-6 @min-[1040px]:pr-36">
            <h1 className="font-display text-base leading-5 font-semibold @min-[672px]:max-w-64 @min-[672px]:shrink-0 @min-[672px]:text-lg @min-[672px]:leading-6">{t.home.heroTitle}</h1>
            <p className="hidden max-w-sm text-sm leading-5 text-white/85 @min-[880px]:block">{t.home.heroText}</p>
            <div className="flex flex-wrap items-center gap-x-2 text-[13px] leading-5 @min-[672px]:ml-auto @min-[672px]:block @min-[672px]:shrink-0 @min-[672px]:text-sm @min-[1040px]:ml-0">
              <span className="inline-block bg-accent px-1 font-medium text-ink">{fmt(t.home.perks.delivery, { rate })}</span>
              <p className="@min-[672px]:mt-0.5">
                <span className="@min-[672px]:hidden">{fmt(t.home.minOrderShort, { min })}</span>
                <span className="hidden @min-[672px]:inline">{fmt(t.home.minOrder, { min })}</span> ·{" "}
                <Link href={`/${locale}/delivery`} className="underline underline-offset-2 hover:text-white/80">
                  {t.home.more}
                </Link>
              </p>
              <p className="hidden text-white/70 @min-[672px]:block">{t.home.perks.payment}</p>
            </div>
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
