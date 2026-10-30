import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { getCategoryRows, getSaleProducts, listCategories, SALE_CATEGORY_SLUG } from "@/lib/catalog";
import { ProductRow } from "@/components/product-row";

/** The store's front page after Everli: a banner, then a sideways row of products for the sale and every category. */
export default async function HomePage() {
  const { locale, t } = await getI18n();
  const [categories, sale, rows] = await Promise.all([listCategories(locale), getSaleProducts(20), getCategoryRows(12)]);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-lg bg-store px-6 py-7 text-white md:px-10 md:py-9">
        <div className="absolute -top-20 -right-10 h-64 w-64 rounded-full bg-[#fff000]" aria-hidden />
        <div className="absolute -right-4 -bottom-24 h-44 w-44 rounded-full border-[16px] border-[#e60a14]" aria-hidden />
        <div className="relative max-w-xl">
          <h1 className="font-display text-2xl leading-tight font-semibold md:text-[32px] md:leading-10">{t.home.heroTitle}</h1>
          <p className="mt-2 text-white/85">{t.home.heroText}</p>
          <Link href={`/${locale}/catalog`} className="mt-5 inline-flex h-11 items-center rounded-full bg-white px-5 font-display font-semibold text-ink transition-colors hover:bg-white/90">
            {t.home.heroCta}
          </Link>
        </div>
      </section>

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
