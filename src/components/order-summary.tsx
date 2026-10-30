import { fmt } from "@/i18n";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { shop } from "@/config/shop";
import { formatPrice } from "@/lib/money";

export function OrderSummary({
  locale,
  t,
  subtotalMinor,
  deliveryFeeMinor,
  totalMinor,
  className = "card p-5",
  children,
}: {
  locale: Locale;
  t: Dictionary;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  /** The frame; the cart panel passes "" to show the summary without one. */
  className?: string;
  children?: React.ReactNode;
}) {
  const rate = `${Math.round(shop.deliveryFeeRate * 100)}%`;
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex justify-between text-[15px]">
        <span>{t.cart.subtotal}</span>
        <span className="font-semibold tabular-nums" data-testid="subtotal">
          {formatPrice(subtotalMinor, locale)}
        </span>
      </div>
      <div className="flex justify-between text-[15px]">
        <span>{fmt(t.cart.delivery, { rate })}</span>
        <span className="font-semibold tabular-nums" data-testid="delivery-fee">
          {formatPrice(deliveryFeeMinor, locale)}
        </span>
      </div>
      <div className="flex justify-between border-t border-line pt-3 font-display text-lg font-semibold">
        <span>{t.cart.total}</span>
        <span className="tabular-nums" data-testid="total">
          {formatPrice(totalMinor, locale)}
        </span>
      </div>
      {children}
    </div>
  );
}

export function MinOrderProgress({ locale, t, subtotalMinor }: { locale: Locale; t: Dictionary; subtotalMinor: number }) {
  const missing = Math.max(0, shop.minOrderMinor - subtotalMinor);
  const pct = Math.min(100, Math.round((subtotalMinor / shop.minOrderMinor) * 100));
  if (missing === 0) return null;
  return (
    <div className="space-y-2 rounded-xl bg-brand-light p-3 text-sm" data-testid="min-order">
      <div className="font-semibold text-brand-dark">{fmt(t.cart.toMinOrder, { amount: formatPrice(missing, locale) })}</div>
      <div className="h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-muted">{fmt(t.cart.minOrder, { min: formatPrice(shop.minOrderMinor, locale) })}</div>
    </div>
  );
}
