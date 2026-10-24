"use client";

import { shop } from "@/config/shop";
import { formatQty } from "@/lib/format";
import { useShop } from "./shop-provider";
import { CartIcon, MinusIcon, PlusIcon } from "./icons";

export function QtyControl({
  productId,
  soldByWeight,
  unit,
  size = "md",
}: {
  productId: number;
  soldByWeight: boolean;
  unit: string | null;
  size?: "md" | "lg";
}) {
  const { quantities, setQty, t, locale } = useShop();
  const qty = quantities[productId] ?? 0;
  const step = soldByWeight ? shop.weightStepKg : 1;
  const height = size === "lg" ? "h-12" : "h-10";

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => setQty(productId, step)}
        className={`btn-primary w-full ${height} px-3 py-0`}
        data-testid="add-to-cart"
      >
        <CartIcon size={18} />
        {t.product.addToCart}
      </button>
    );
  }

  return (
    <div className={`flex w-full items-center justify-between rounded bg-brand text-white ${height}`} data-testid="qty-control">
      <button
        type="button"
        onClick={() => setQty(productId, Math.max(0, +(qty - step).toFixed(3)))}
        className="flex h-full w-11 items-center justify-center rounded-l hover:bg-brand-dark"
        aria-label={t.product.decrease}
      >
        <MinusIcon size={18} />
      </button>
      <span className="text-[15px] font-semibold tabular-nums" data-testid="qty-value">
        {formatQty(qty, unit, locale)}
      </span>
      <button
        type="button"
        onClick={() => setQty(productId, +(qty + step).toFixed(3))}
        className="flex h-full w-11 items-center justify-center rounded-r hover:bg-brand-dark"
        aria-label={t.product.increase}
      >
        <PlusIcon size={18} />
      </button>
    </div>
  );
}
