import Link from "next/link";
import { Suspense } from "react";
import { fmt, plural } from "@/i18n";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { listCategories, listProducts, type CategoryData } from "@/lib/catalog";
import { parseSort } from "@/lib/sort-options";
import { ProductGrid } from "./product-card";
import { CatalogToolbar } from "./catalog-toolbar";

type Search = { [key: string]: string | string[] | undefined };

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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
    <div className="grid gap-6 lg:grid-cols-[230px_1fr] 2xl:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block">
        <CategoryList locale={locale} t={t} categories={categories} activeSlug={category?.slug} />
      </aside>
      <section>
        <h1 className="mb-3 text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
        <Suspense>
          <CatalogToolbar countLabel={plural(t.catalog.items, result.total, locale)} showSaleToggle={!category?.isSale} />
        </Suspense>
        {result.items.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="text-lg font-bold">{t.catalog.empty}</div>
            <p className="mt-1 text-muted">{t.catalog.emptyText}</p>
          </div>
        ) : (
          <ProductGrid products={result.items} />
        )}
        {result.pages > 1 && (
          <nav className="mt-6 flex items-center justify-center gap-3" aria-label="pagination">
            {result.page > 1 && (
              <Link href={pageHref(result.page - 1)} className="btn-secondary px-4 py-2">
                {t.catalog.prev}
              </Link>
            )}
            <span className="text-sm text-muted">{fmt(t.catalog.page, { page: result.page, pages: result.pages })}</span>
            {result.page < result.pages && (
              <Link href={pageHref(result.page + 1)} className="btn-secondary px-4 py-2">
                {t.catalog.next}
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}

function CategoryList({
  locale,
  t,
  categories,
  activeSlug,
}: {
  locale: Locale;
  t: Dictionary;
  categories: CategoryData[];
  activeSlug?: string;
}) {
  const link = "flex justify-between gap-2 rounded px-3 py-2 text-sm hover:bg-white";
  return (
    <nav className="sticky top-32">
      <ul className="space-y-0.5">
        <li>
          <Link href={`/${locale}/catalog`} className={`${link} ${!activeSlug ? "bg-white font-bold text-brand" : ""}`}>
            {t.catalog.allCategories}
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/${locale}/catalog/${c.slug}`}
              className={`${link} ${activeSlug === c.slug ? "bg-white font-bold text-brand" : ""} ${c.isSale ? "font-semibold text-sale" : ""}`}
            >
              <span>{c.name}</span>
              <span className="text-muted">{c.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
