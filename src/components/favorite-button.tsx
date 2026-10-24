"use client";

import { useShop } from "./shop-provider";
import { HeartIcon } from "./icons";

export function FavoriteButton({ productId, className = "" }: { productId: number; className?: string }) {
  const { favorites, toggleFav, t } = useShop();
  const on = favorites.has(productId);
  return (
    <button
      type="button"
      onClick={() => toggleFav(productId)}
      aria-pressed={on}
      aria-label={on ? t.product.favoriteRemove : t.product.favoriteAdd}
      title={on ? t.product.favoriteRemove : t.product.favoriteAdd}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/90 transition hover:bg-white ${
        on ? "text-sale" : "text-muted hover:text-sale"
      } ${className}`}
      data-testid="favorite"
    >
      <HeartIcon size={20} filled={on} />
    </button>
  );
}
