"use client";

import { createContext, use, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toggleFavorite, updateCartItem } from "@/actions/cart";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { lineTotal } from "@/lib/money";

type ShopContextValue = {
  locale: Locale;
  t: Dictionary;
  quantities: Record<number, number>;
  favorites: Set<number>;
  cartCount: number;
  /** Sum of the cart lines at known prices, updated optimistically with the quantities. */
  cartSubtotal: number;
  pending: boolean;
  /** `priceMinor` (the product's current price) keeps the header total right before the server answers. */
  setQty: (productId: number, qty: number, priceMinor?: number) => void;
  /** Adds delta to the latest quantity, so rapid taps accumulate instead of reading a stale render. */
  changeQty: (productId: number, delta: number, priceMinor?: number) => void;
  toggleFav: (productId: number) => void;
};

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({
  locale,
  dictionary,
  initialQuantities,
  initialPrices,
  initialFavorites,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  initialQuantities: Record<number, number>;
  initialPrices: Record<number, number>;
  initialFavorites: number[];
  children: ReactNode;
}) {
  const [quantities, setQuantities] = useState(initialQuantities);
  const [prices, setPrices] = useState(initialPrices);
  const [favorites, setFavorites] = useState(() => new Set(initialFavorites));
  const [pending, startTransition] = useTransition();

  // Latest quantities including optimistic changes not yet rendered, and the newest cart request (overall and per product).
  const latest = useRef(quantities);
  const lastRequest = useRef(0);
  const lastRequestFor = useRef<Record<number, number>>({});
  // Cart requests run one at a time in tap order: sent in parallel they can reach the database out of order,
  // and an older quantity would overwrite a newer one.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    latest.current = quantities;
  }, [quantities]);

  // Server data wins whenever the layout re-renders (navigation, revalidation after an action),
  // but not while cart updates are still in flight: their optimistic values are newer.
  const [prevQuantities, setPrevQuantities] = useState(initialQuantities);
  const [prevFavorites, setPrevFavorites] = useState(initialFavorites);
  const [prevPrices, setPrevPrices] = useState(initialPrices);
  if (prevQuantities !== initialQuantities && !pending) {
    setPrevQuantities(initialQuantities);
    setQuantities(initialQuantities);
  }
  if (prevPrices !== initialPrices) {
    setPrevPrices(initialPrices);
    setPrices((prev) => ({ ...prev, ...initialPrices }));
  }
  if (prevFavorites !== initialFavorites) {
    setPrevFavorites(initialFavorites);
    setFavorites(new Set(initialFavorites));
  }

  function setQty(productId: number, qty: number, priceMinor?: number) {
    if (priceMinor != null && prices[productId] !== priceMinor) setPrices((prev) => ({ ...prev, [productId]: priceMinor }));
    const next = { ...latest.current };
    if (qty <= 0) delete next[productId];
    else next[productId] = qty;
    latest.current = next;
    setQuantities(next);
    const request = ++lastRequest.current;
    lastRequestFor.current[productId] = request;
    startTransition(async () => {
      // A tap superseded by a later one for the same product while waiting in the queue is not sent at all.
      const run = queue.current.then(() => (lastRequestFor.current[productId] === request ? updateCartItem(productId, qty) : null));
      queue.current = run.catch(() => {});
      const saved = await run;
      // An older response must not roll back a newer optimistic value.
      if (saved && request === lastRequest.current) setQuantities(saved);
    });
  }

  function changeQty(productId: number, delta: number, priceMinor?: number) {
    setQty(productId, Math.max(0, +((latest.current[productId] ?? 0) + delta).toFixed(3)), priceMinor);
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
  const cartSubtotal = Object.entries(quantities).reduce((sum, [id, qty]) => sum + lineTotal(prices[Number(id)] ?? 0, qty), 0);

  return (
    <ShopContext value={{ locale, t: dictionary, quantities, favorites, cartCount, cartSubtotal, pending, setQty, changeQty, toggleFav }}>
      {children}
    </ShopContext>
  );
}

export function useShop() {
  const ctx = use(ShopContext);
  if (!ctx) throw new Error("useShop must be used inside ShopProvider");
  return ctx;
}
