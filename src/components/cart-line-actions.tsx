"use client";

import { useTransition } from "react";
import { emptyCart } from "@/actions/cart";
import { useShop } from "./shop-provider";
import { TrashIcon } from "./icons";

export function RemoveLineButton({ productId }: { productId: number }) {
  const { setQty, t } = useShop();
  return (
    <button
      type="button"
      onClick={() => setQty(productId, 0)}
      className="flex items-center gap-1 text-sm text-muted hover:text-sale"
      data-testid="remove-line"
    >
      <TrashIcon size={16} />
      {t.cart.remove}
    </button>
  );
}

export function ClearCartButton() {
  const { t } = useShop();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => emptyCart())} className="text-sm text-muted hover:text-sale">
      {t.cart.clear}
    </button>
  );
}
