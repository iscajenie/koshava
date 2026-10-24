"use client";

import { createContext, use, useState, useTransition, type ReactNode } from "react";
import { toggleFavorite, updateCartItem } from "@/actions/cart";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

type ShopContextValue = {
  locale: Locale;
  t: Dictionary;
  quantities: Record<number, number>;
  favorites: Set<number>;
  cartCount: number;
  pending: boolean;
  setQty: (productId: number, qty: number) => void;
  toggleFav: (productId: number) => void;
};

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({
  locale,
  dictionary,
  initialQuantities,
  initialFavorites,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  initialQuantities: Record<number, number>;
  initialFavorites: number[];
  children: ReactNode;
}) {
  const [quantities, setQuantities] = useState(initialQuantities);
  const [favorites, setFavorites] = useState(() => new Set(initialFavorites));
  const [pending, startTransition] = useTransition();

  // Server data wins whenever the layout re-renders (navigation, revalidation after an action).
  const [prevQuantities, setPrevQuantities] = useState(initialQuantities);
  const [prevFavorites, setPrevFavorites] = useState(initialFavorites);
  if (prevQuantities !== initialQuantities) {
    setPrevQuantities(initialQuantities);
    setQuantities(initialQuantities);
  }
  if (prevFavorites !== initialFavorites) {
    setPrevFavorites(initialFavorites);
    setFavorites(new Set(initialFavorites));
  }

  function setQty(productId: number, qty: number) {
    setQuantities((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
    startTransition(async () => {
      setQuantities(await updateCartItem(productId, qty));
    });
  }

  function toggleFav(productId: number) {
    const on = !favorites.has(productId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (on) next.add(productId);
      else next.delete(productId);
      return next;
    });
    startTransition(() => toggleFavorite(productId, on));
  }

  const cartCount = Object.keys(quantities).length;

  return (
    <ShopContext value={{ locale, t: dictionary, quantities, favorites, cartCount, pending, setQty, toggleFav }}>
      {children}
    </ShopContext>
  );
}

export function useShop() {
  const ctx = use(ShopContext);
  if (!ctx) throw new Error("useShop must be used inside ShopProvider");
  return ctx;
}
