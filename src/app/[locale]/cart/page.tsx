import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n";
import { shop } from "@/config/shop";
import { cartTotals, getCartLines } from "@/lib/cart";
import { formatPrice } from "@/lib/money";
import { unitLabel } from "@/lib/format";
import { QtyControl } from "@/components/qty-control";
import { ProductImage } from "@/components/product-image";
import { ClearCartButton, RemoveLineButton } from "@/components/cart-line-actions";
import { MinOrderProgress, OrderSummary } from "@/components/order-summary";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.cart.title };
}

export default async function CartPage() {
  const { locale, t } = await getI18n();
  const lines = await getCartLines();
  const totals = cartTotals(lines);

  if (lines.length === 0) {
    return (
      <div className="card mx-auto max-w-lg p-10 text-center">
        <h1 className="text-2xl font-extrabold">{t.cart.empty}</h1>
        <p className="mt-2 text-muted">{t.cart.emptyText}</p>
        <Link href={`/${locale}/catalog`} className="btn-primary mt-6">
          {t.cart.goCatalog}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t.cart.title}</h1>
          <ClearCartButton />
        </div>
        <ul className="card divide-y divide-line">
          {lines.map((line) => (
            <li key={line.productId} className="flex gap-3 p-3 sm:gap-4 sm:p-4" data-testid="cart-line">
              <Link href={`/${locale}/p/${line.slug}`} className="h-20 w-20 shrink-0 sm:h-24 sm:w-24">
                <ProductImage src={line.imageUrl} alt="" className={line.available ? "" : "opacity-40 grayscale"} />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/${locale}/p/${line.slug}`} className="line-clamp-2 font-medium hover:text-brand">
                    {line.name}
                  </Link>
                  <div className="mt-0.5 text-sm text-muted">
                    {formatPrice(line.priceMinor, locale)} / {unitLabel(line.unit, locale)}
                  </div>
                  {!line.available && <div className="mt-1 text-sm font-medium text-sale">{t.cart.unavailable}</div>}
                  <div className="mt-1">
                    <RemoveLineButton productId={line.productId} />
                  </div>
                </div>
                {line.available && (
                  <div className="flex items-center justify-between gap-4 sm:w-64">
                    <div className="w-36">
                      <QtyControl productId={line.productId} soldByWeight={line.soldByWeight} unit={line.unit} />
                    </div>
                    <div className="text-right font-bold whitespace-nowrap tabular-nums">{formatPrice(line.lineTotalMinor, locale)}</div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          {t.cart.priceNote} {t.cart.noSubstitutions}
        </p>
      </section>
      <aside className="space-y-3 lg:sticky lg:top-32 lg:self-start">
        <OrderSummary locale={locale} t={t} {...totals}>
          <MinOrderProgress locale={locale} t={t} subtotalMinor={totals.subtotalMinor} />
          {totals.exceedsMaximum && (
            <div className="rounded bg-sale/10 p-3 text-sm font-semibold text-sale" data-testid="max-order">
              {fmt(t.cart.maxOrder, { max: formatPrice(shop.maxOrderMinor, locale) })}
            </div>
          )}
          {totals.meetsMinimum && !totals.exceedsMaximum ? (
            <Link href={`/${locale}/checkout`} className="btn-primary w-full" data-testid="checkout-link">
              {t.cart.checkout}
            </Link>
          ) : (
            <button type="button" disabled className="btn-primary w-full">
              {t.cart.checkout}
            </button>
          )}
        </OrderSummary>
      </aside>
    </div>
  );
}
