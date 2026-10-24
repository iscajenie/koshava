"use client";

import { createContext, use, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
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
  /** Adds delta to the latest quantity, so rapid taps accumulate instead of reading a stale render. */
  changeQty: (productId: number, delta: number) => void;
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

  // Latest quantities including optimistic changes not yet rendered, and the newest cart request.
  const latest = useRef(quantities);
  const lastRequest = useRef(0);
  useEffect(() => {
    latest.current = quantities;
  }, [quantities]);

  // Server data wins whenever the layout re-renders (navigation, revalidation after an action),
  // but not while cart updates are still in flight: their optimistic values are newer.
  const [prevQuantities, setPrevQuantities] = useState(initialQuantities);
  const [prevFavorites, setPrevFavorites] = useState(initialFavorites);
  if (prevQuantities !== initialQuantities && !pending) {
    setPrevQuantities(initialQuantities);
    setQuantities(initialQuantities);
  }
  if (prevFavorites !== initialFavorites) {
    setPrevFavorites(initialFavorites);
    setFavorites(new Set(initialFavorites));
  }

  function setQty(productId: number, qty: number) {
    const next = { ...latest.current };
    if (qty <= 0) delete next[productId];
    else next[productId] = qty;
    latest.current = next;
    setQuantities(next);
    const request = ++lastRequest.current;
    startTransition(async () => {
      const saved = await updateCartItem(productId, qty);
      // An older response must not roll back a newer optimistic value.
      if (request === lastRequest.current) setQuantities(saved);
    });
  }

  function changeQty(productId: number, delta: number) {
    setQty(productId, Math.max(0, +((latest.current[productId] ?? 0) + delta).toFixed(3)));
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
    <ShopContext value={{ locale, t: dictionary, quantities, favorites, cartCount, pending, setQty, changeQty, toggleFav }}>
      {children}
    </ShopContext>
  );
}

export function useShop() {
  const ctx = use(ShopContext);
  if (!ctx) throw new Error("useShop must be used inside ShopProvider");
  return ctx;
}
