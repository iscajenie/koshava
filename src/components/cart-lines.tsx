import Link from "next/link";
import { fmt } from "@/i18n";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { shop } from "@/config/shop";
import type { CartLine, cartTotals } from "@/lib/cart";
import { formatPrice } from "@/lib/money";
import { unitLabel } from "@/lib/format";
import { ProductImage } from "./product-image";
import { QtyControl } from "./qty-control";
import { RemoveLineButton } from "./cart-line-actions";
import { MinOrderProgress, OrderSummary } from "./order-summary";

/** One cart line: photo, name, unit price, the quantity pill and the line total. */
export function CartLineRow({ line, locale, t }: { line: CartLine; locale: Locale; t: Dictionary }) {
  const href = `/${locale}/p/${line.slug}`;
  return (
    <li className="flex gap-3 py-4" data-testid="cart-line">
      <Link href={href} scroll={false} className="h-16 w-16 shrink-0 sm:h-20 sm:w-20">
        <ProductImage src={line.imageUrl} alt="" className={line.available ? "" : "opacity-40 grayscale"} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={href} scroll={false} className="line-clamp-2 text-sm font-medium hover:underline">
          {line.name}
        </Link>
        <div className="mt-0.5 text-xs text-muted">
          {formatPrice(line.priceMinor, locale)} / {unitLabel(line.unit, locale)}
        </div>
        {line.available ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="w-36">
              <QtyControl productId={line.productId} priceMinor={line.priceMinor} soldByWeight={line.soldByWeight} unit={line.unit} />
            </div>
            <div className="font-display font-semibold whitespace-nowrap tabular-nums">{formatPrice(line.lineTotalMinor, locale)}</div>
          </div>
        ) : (
          <>
            <div className="mt-1 text-sm font-medium text-sale">{t.cart.unavailable}</div>
            <div className="mt-1">
              <RemoveLineButton productId={line.productId} />
            </div>
          </>
        )}
      </div>
    </li>
  );
}

/** Totals with the minimum-order progress, the maximum-order warning and the checkout button. */
export function CartSummary({
  locale,
  t,
  totals,
  className,
}: {
  locale: Locale;
  t: Dictionary;
  totals: ReturnType<typeof cartTotals>;
  className?: string;
}) {
  return (
    <OrderSummary locale={locale} t={t} {...totals} className={className}>
      <MinOrderProgress locale={locale} t={t} subtotalMinor={totals.subtotalMinor} />
      {totals.exceedsMaximum && (
        <div className="rounded-xl bg-sale/10 p-3 text-sm font-medium text-sale" data-testid="max-order">
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
  );
}
