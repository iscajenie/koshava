import Link from "next/link";
import { Suspense } from "react";
import { fmt, plural } from "@/i18n";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { listCategories, listProducts } from "@/lib/catalog";
import { parseSort } from "@/lib/sort-options";
import { ProductGrid } from "./product-card";
import { CatalogToolbar } from "./catalog-toolbar";

type Search = { [key: string]: string | string[] | undefined };

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** A category, the sale, search results or the whole catalog: title, filter chips, the product grid and pages. */
export async function CatalogView({
  locale,
  t,
  category,
  searchParams,
}: {
  locale: Locale;
  t: Dictionary;
  category?: { id: number; slug: string; name: string; isSale?: boolean };
  searchParams: Search;
}) {
  const q = one(searchParams.q)?.trim().slice(0, 100) || undefined;
  const onlySale = category?.isSale || one(searchParams.sale) === "1";
  const sort = parseSort(one(searchParams.sort));
  const page = Math.max(1, Number(one(searchParams.page)) || 1);
  const [result, categories] = await Promise.all([
    listProducts({ categoryId: category?.isSale ? undefined : category?.id, q, onlySale, sort, page }),
    listCategories(locale),
  ]);

  const title = q ? fmt(t.catalog.searchTitle, { q }) : category ? category.name : onlySale ? t.catalog.saleTitle : t.catalog.title;

  function pageHref(n: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && k !== "page") params.set(k, v);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return `/${locale}/catalog${category ? `/${category.slug}` : ""}${qs ? `?${qs}` : ""}`;
  }

  return (
    <section>
      <h1 className="font-display text-[28px] leading-9 font-semibold md:text-4xl md:leading-[44px]">{title}</h1>

      {/* Phones have no sidebar: categories scroll as chips under the title. */}
      <ul className="scrollbar-none -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
        <li>
          <Link href={`/${locale}/catalog`} className={`chip ${!category ? "chip-active" : ""}`}>
            {t.catalog.allCategories}
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.slug}>
            <Link href={`/${locale}/catalog/${c.slug}`} className={`chip ${c.slug === category?.slug ? "chip-active" : c.isSale ? "text-sale" : ""}`}>
              {c.name}
            </Link>
          </li>
        ))}
      </ul>

      <Suspense>
        <CatalogToolbar countLabel={plural(t.catalog.items, result.total, locale)} showSaleToggle={!category?.isSale} />
      </Suspense>

      {result.items.length === 0 ? (
        <div className="rounded-3xl bg-surface p-10 text-center">
          <div className="font-display text-lg font-semibold">{t.catalog.empty}</div>
          <p className="mt-1 text-muted">{t.catalog.emptyText}</p>
        </div>
      ) : (
        <ProductGrid products={result.items} />
      )}

      {result.pages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-3" aria-label="pagination">
          {result.page > 1 && (
            <Link href={pageHref(result.page - 1)} className="btn-secondary h-10 px-5">
              {t.catalog.prev}
            </Link>
          )}
          <span className="text-sm text-muted">{fmt(t.catalog.page, { page: result.page, pages: result.pages })}</span>
          {result.page < result.pages && (
            <Link href={pageHref(result.page + 1)} className="btn-secondary h-10 px-5">
              {t.catalog.next}
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}
