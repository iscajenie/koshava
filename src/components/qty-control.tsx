"use client";

import { shop } from "@/config/shop";
import { formatQty } from "@/lib/format";
import { useShop } from "./shop-provider";
import { MinusIcon, PlusIcon, TrashIcon } from "./icons";

/** Quantity stepper of a cart line: a grey pill "− quantity +", the minus turning into "remove" at the last step. */
export function QtyControl({
  productId,
  priceMinor,
  soldByWeight,
  unit,
}: {
  productId: number;
  priceMinor?: number;
  soldByWeight: boolean;
  unit: string | null;
}) {
  const { quantities, changeQty, t, locale } = useShop();
  const qty = quantities[productId] ?? 0;
  const step = soldByWeight ? shop.weightStepKg : 1;
  const last = qty <= step;
  const button = "flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-surface-strong";

  return (
    <div className="flex h-10 w-full items-center justify-between rounded-full bg-surface" data-testid="qty-control">
      <button type="button" onClick={() => changeQty(productId, -step, priceMinor)} className={button} aria-label={last ? t.cart.remove : t.product.decrease}>
        {last ? <TrashIcon size={18} /> : <MinusIcon size={18} />}
      </button>
      <span className="text-[15px] font-medium whitespace-nowrap tabular-nums" data-testid="qty-value">
        {formatQty(qty, unit, locale)}
      </span>
      <button type="button" onClick={() => changeQty(productId, step, priceMinor)} className={button} aria-label={t.product.increase}>
        <PlusIcon size={18} />
      </button>
    </div>
  );
}
