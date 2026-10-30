import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { plural } from "@/i18n";
import { cartTotals, getCartLines } from "@/lib/cart";
import { ClearCartButton } from "@/components/cart-line-actions";
import { CartLineRow, CartSummary } from "@/components/cart-lines";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.cart.title };
}

/** The cart as a page (a shared link or a reload); from the header it opens as a side panel (@modal/(.)cart). */
export default async function CartPage() {
  const { locale, t } = await getI18n();
  const lines = await getCartLines();
  const totals = cartTotals(lines);

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-line p-10 text-center">
        <h1 className="font-display text-2xl font-semibold">{t.cart.empty}</h1>
        <p className="mt-2 text-muted">{t.cart.emptyText}</p>
        <Link href={`/${locale}`} className="btn-primary mt-6">
          {t.cart.goCatalog}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1100px] gap-8 lg:grid-cols-[1fr_360px]">
      <section>
        <div className="mb-2 flex items-baseline gap-3">
          <h1 className="font-display text-[28px] leading-9 font-semibold md:text-4xl md:leading-[44px]">{t.cart.title}</h1>
          <span className="text-sm text-muted">{plural(t.catalog.items, lines.length, locale)}</span>
          <span className="ml-auto">
            <ClearCartButton />
          </span>
        </div>
        <ul className="divide-y divide-line border-b border-line">
          {lines.map((line) => (
            <CartLineRow key={line.productId} line={line} locale={locale} t={t} />
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          {t.cart.priceNote} {t.cart.noSubstitutions}
        </p>
      </section>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <CartSummary locale={locale} t={t} totals={totals} className="rounded-3xl border border-line p-5" />
      </aside>
    </div>
  );
}
