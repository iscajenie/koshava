import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n";
import { shop } from "@/config/shop";
import { formatPrice } from "@/lib/money";
import { getFeaturedProducts, getSaleProducts, listCategories } from "@/lib/catalog";
import { ProductGrid } from "@/components/product-card";
import { SectionHeader } from "@/components/section-header";
import { TagIcon, TruckIcon, WalletIcon } from "@/components/icons";

export default async function HomePage() {
  const { locale, t } = await getI18n();
  const [categories, sale, featured] = await Promise.all([
    listCategories(locale),
    getSaleProducts(10),
    getFeaturedProducts(10),
  ]);
  const rate = `${Math.round(shop.deliveryFeeRate * 100)}%`;
  const min = formatPrice(shop.minOrderMinor, locale);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-lg bg-brand px-6 py-8 text-white md:px-10 md:py-12">
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-accent/90" aria-hidden />
        <div className="absolute -right-6 -bottom-20 h-40 w-40 rounded-full border-[14px] border-sale" aria-hidden />
        <div className="relative max-w-xl">
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight md:text-4xl">{t.home.heroTitle}</h1>
          <p className="mt-3 text-white/85 md:text-lg">{t.home.heroText}</p>
          <Link href={`/${locale}/catalog`} className="mt-6 inline-flex rounded bg-accent px-6 py-3 font-bold text-ink hover:brightness-95">
            {t.home.heroCta}
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: TagIcon, title: t.home.perks.prices, text: t.home.perks.pricesText },
          { icon: TruckIcon, title: fmt(t.home.perks.delivery, { rate }), text: fmt(t.home.perks.deliveryText, { min }) },
          { icon: WalletIcon, title: t.home.perks.payment, text: t.home.perks.paymentText },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="card flex items-start gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
              <Icon size={22} />
            </span>
            <div>
              <div className="font-bold">{title}</div>
              <div className="text-sm text-muted">{text}</div>
            </div>
          </div>
        ))}
      </section>

      {categories.length > 0 && (
        <section>
          <SectionHeader title={t.home.categories} />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/${locale}/catalog/${c.slug}`} className="card flex h-full flex-col items-center gap-2 p-3 text-center hover:border-brand">
                  <div className="aspect-square w-full max-w-28">
                    {c.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image} alt="" loading="lazy" className="h-full w-full object-contain" />
                    )}
                  </div>
                  <span className="text-sm leading-tight font-semibold">{c.name}</span>
                  <span className="text-xs text-muted">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sale.length > 0 && (
        <section>
          <SectionHeader title={t.home.onSale} href={`/${locale}/catalog?sale=1`} linkLabel={t.home.allOnSale} />
          <ProductGrid products={sale} />
        </section>
      )}

      {featured.length > 0 && (
        <section>
          <SectionHeader title={t.home.popular} href={`/${locale}/catalog`} linkLabel={t.home.showAll} />
          <ProductGrid products={featured} />
        </section>
      )}
    </div>
  );
}
