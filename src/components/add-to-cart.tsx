"use client";

import Link from "next/link";
import { useState } from "react";
import { shop } from "@/config/shop";
import { formatQty } from "@/lib/format";
import { useShop } from "./shop-provider";
import { CheckIcon, MinusIcon, PlusIcon, TrashIcon } from "./icons";

type Props = { productId: number; priceMinor: number; soldByWeight: boolean; unit: string | null };

const shadow = "shadow-[0_2px_8px_rgba(0,0,0,0.16)]";

/** The card's round green "+"; once the product is in the cart it widens into "remove · quantity · +". */
export function CardCartControl({ productId, priceMinor, soldByWeight, unit }: Props) {
  const { quantities, setQty, changeQty, t, locale } = useShop();
  const qty = quantities[productId] ?? 0;
  const step = soldByWeight ? shop.weightStepKg : 1;

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => setQty(productId, step, priceMinor)}
        className={`flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-dark ${shadow}`}
        aria-label={t.product.addToCart}
        title={t.product.addToCart}
        data-testid="add-to-cart"
      >
        <PlusIcon size={22} />
      </button>
    );
  }

  const last = qty <= step;
  return (
    <div className={`flex h-10 items-center rounded-full bg-brand text-white ${shadow}`} data-testid="qty-control">
      <button
        type="button"
        onClick={() => changeQty(productId, -step, priceMinor)}
        className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-brand-dark"
        aria-label={last ? t.cart.remove : t.product.decrease}
      >
        {last ? <TrashIcon size={18} /> : <MinusIcon size={18} />}
      </button>
      <span className="min-w-12 px-0.5 text-center text-[15px] font-medium whitespace-nowrap tabular-nums" data-testid="qty-value">
        {formatQty(qty, unit, locale)}
      </span>
      <button
        type="button"
        onClick={() => changeQty(productId, step, priceMinor)}
        className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-brand-dark"
        aria-label={t.product.increase}
      >
        <PlusIcon size={18} />
      </button>
    </div>
  );
}

/**
 * The product card's buying row, as in Everli's product popup: pick a quantity, then "Add"; once in the cart the
 * stepper changes the cart directly and the button leads to the cart.
 */
export function BuyBox({ productId, priceMinor, soldByWeight, unit }: Props) {
  const { quantities, setQty, changeQty, t, locale } = useShop();
  const qty = quantities[productId] ?? 0;
  const step = soldByWeight ? shop.weightStepKg : 1;
  const [pick, setPick] = useState(step);
  const inCart = qty > 0;
  const value = inCart ? qty : pick;
  const change = (delta: number) =>
    inCart ? changeQty(productId, delta, priceMinor) : setPick((p) => Math.max(step, +(p + delta).toFixed(3)));
  const button = "flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:bg-surface-strong disabled:text-faint disabled:hover:bg-transparent";

  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex h-12 min-w-44 flex-1 items-center justify-between rounded-full bg-surface" data-testid={inCart ? "qty-control" : undefined}>
        <button
          type="button"
          onClick={() => change(-step)}
          disabled={!inCart && pick <= step}
          className={button}
          aria-label={inCart && value <= step ? t.cart.remove : t.product.decrease}
        >
          {inCart && value <= step ? <TrashIcon size={20} /> : <MinusIcon size={20} />}
        </button>
        <span className="font-display text-lg font-medium whitespace-nowrap tabular-nums" data-testid="qty-value">
          {formatQty(value, unit, locale)}
        </span>
        <button type="button" onClick={() => change(step)} className={button} aria-label={t.product.increase}>
          <PlusIcon size={20} />
        </button>
      </div>
      {inCart ? (
        <Link href={`/${locale}/cart`} scroll={false} className="btn-primary min-w-40 flex-1 bg-brand-light text-brand hover:bg-[#e6f2df]">
          <CheckIcon size={20} />
          {t.product.inCart}
        </Link>
      ) : (
        <button type="button" onClick={() => setQty(productId, pick, priceMinor)} className="btn-primary min-w-40 flex-1" data-testid="add-to-cart">
          {t.product.add}
        </button>
      )}
    </div>
  );
}
