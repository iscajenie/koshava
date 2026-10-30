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
        {/* 180 px high: the delivery fee, the title and the description in one column. The order terms sit next to
            the fee until the header has room for them (xl). Sizes follow the banner's own width, which changes with
            the sidebar. */}
        <section className="@container relative flex min-h-[180px] overflow-hidden rounded-lg bg-store text-white">
          {/* The logo's colours as decoration, where there is room for them beside the text. */}
          <div className="absolute -top-14 -right-8 hidden size-40 rounded-full bg-[#fff000] @min-[1040px]:block" aria-hidden />
          <div className="absolute right-28 -bottom-10 hidden size-24 rounded-full border-[12px] border-[#e60a14] @min-[1040px]:block" aria-hidden />
          <div className="relative flex w-full flex-col justify-center px-4 py-4 @min-[640px]:px-6 @min-[640px]:py-5 @min-[880px]:px-8 @min-[1040px]:pr-56">
            <div className="flex flex-wrap items-center gap-x-2 text-[13px] leading-5 @max-[300px]:text-xs @min-[640px]:text-sm">
              <span className="bg-accent px-1 font-medium text-ink">{fmt(t.home.perks.delivery, { rate })}</span>
              <span className="xl:hidden">
                <span className="@min-[640px]:hidden">{fmt(t.home.minOrderShort, { min })}</span>
                <span className="hidden @min-[640px]:inline">{fmt(t.home.minOrder, { min })}</span> ·{" "}
                <Link href={`/${locale}/delivery`} className="underline underline-offset-2 hover:text-white/80">
                  {t.home.more}
                </Link>
                <span className="hidden text-white/70 @min-[640px]:inline"> · {t.home.perks.payment}</span>
              </span>
            </div>
            <h1 className="mt-1.5 font-display text-lg leading-6 font-semibold @min-[640px]:mt-2 @min-[640px]:text-[22px] @min-[640px]:leading-7 @min-[880px]:mt-2.5 @min-[880px]:text-[28px] @min-[880px]:leading-9">{t.home.heroTitle}</h1>
            <p className="mt-1 max-w-[720px] text-sm leading-5 text-white/85 @min-[640px]:mt-1.5 @min-[880px]:mt-2 @min-[880px]:text-base @min-[880px]:leading-6">{t.home.heroText}</p>
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
