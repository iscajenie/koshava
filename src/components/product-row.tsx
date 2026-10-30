"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductCardData } from "@/lib/catalog";
import { useShop } from "./shop-provider";
import { ProductCard } from "./product-card";
import { ChevronRight } from "./icons";

/**
 * A row of product cards that scrolls sideways and fills any screen width, with arrows on desktop.
 * Phones get a two-column grid of the first `mobileLimit` products instead.
 */
export function ProductRow({ products, mobileLimit = 10 }: { products: ProductCardData[]; mobileLimit?: number }) {
  const { t } = useShop();
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const update = () => {
    const el = row.current;
    if (el) setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  };
  useEffect(() => {
    // Fires once on observe and again whenever the row changes width.
    const observer = new ResizeObserver(update);
    if (row.current) observer.observe(row.current);
    return () => observer.disconnect();
  }, []);

  const scroll = (direction: 1 | -1) => {
    const el = row.current;
    el?.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  };
  const arrow = "absolute top-[30%] z-10 hidden h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink shadow-md hover:text-brand lg:flex";

  return (
    <div className="relative">
      <div ref={row} onScroll={update} className="scrollbar-none grid grid-cols-2 gap-3 sm:flex sm:snap-x sm:overflow-x-auto">
        {products.map((product, i) => (
          <div key={product.id} className={`grid sm:w-[200px] sm:shrink-0 sm:snap-start ${i >= mobileLimit ? "max-sm:hidden" : ""}`}>
            <ProductCard product={product} />
          </div>
        ))}
      </div>
      {!edges.start && (
        <button type="button" onClick={() => scroll(-1)} className={`${arrow} -left-4`} aria-label={t.catalog.prev}>
          <ChevronRight size={22} className="rotate-180" />
        </button>
      )}
      {!edges.end && (
        <button type="button" onClick={() => scroll(1)} className={`${arrow} -right-4`} aria-label={t.catalog.next}>
          <ChevronRight size={22} />
        </button>
      )}
    </div>
  );
}
