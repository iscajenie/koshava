import Link from "next/link";
import { plural } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { cartTotals, getCartLines } from "@/lib/cart";
import { CartLineRow, CartSummary } from "./cart-lines";
import { ClearCartButton } from "./cart-line-actions";
import { CartIcon } from "./icons";

/** The cart as a side panel: lines scroll, the totals and the checkout button stay at the bottom. */
export async function CartPanel() {
  const { locale, t } = await getI18n();
  const lines = await getCartLines();

  if (lines.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
          <CartIcon size={28} />
        </span>
        <h2 className="font-display text-xl font-semibold">{t.cart.empty}</h2>
        <p className="text-sm text-muted">{t.cart.emptyText}</p>
        <Link href={`/${locale}/catalog`} className="btn-primary mt-2">
          {t.cart.goCatalog}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline gap-3 border-b border-line px-5 py-5 pr-16">
        <h2 className="font-display text-xl font-semibold">{t.cart.title}</h2>
        <span className="text-sm text-muted">{plural(t.catalog.items, lines.length, locale)}</span>
        <span className="ml-auto">
          <ClearCartButton />
        </span>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto px-5">
        {lines.map((line) => (
          <CartLineRow key={line.productId} line={line} locale={locale} t={t} />
        ))}
      </ul>
      <div className="border-t border-line p-5">
        <CartSummary locale={locale} t={t} totals={cartTotals(lines)} className="" />
      </div>
    </div>
  );
}
