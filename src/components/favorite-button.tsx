"use client";

import { useShop } from "./shop-provider";
import { HeartIcon } from "./icons";

export function FavoriteButton({ productId, variant = "card", className = "" }: { productId: number; variant?: "card" | "plain"; className?: string }) {
  const { favorites, toggleFav, t } = useShop();
  const on = favorites.has(productId);
  return (
    <button
      type="button"
      onClick={() => toggleFav(productId)}
      aria-pressed={on}
      aria-label={on ? t.product.favoriteRemove : t.product.favoriteAdd}
      title={on ? t.product.favoriteRemove : t.product.favoriteAdd}
      data-on={on}
      className={`flex items-center justify-center rounded-full transition ${
        variant === "card" ? "h-8 w-8 bg-white/90 shadow-[0_1px_4px_rgba(0,0,0,0.12)]" : "h-10 w-10 bg-surface hover:bg-surface-strong"
      } ${on ? "text-sale" : "text-muted hover:text-sale"} ${className}`}
      data-testid="favorite"
    >
      <HeartIcon size={variant === "card" ? 18 : 20} filled={on} />
    </button>
  );
}
