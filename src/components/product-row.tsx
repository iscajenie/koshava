"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ProductCardData } from "@/lib/catalog";
import { useShop } from "./shop-provider";
import { ProductCard } from "./product-card";
import { ChevronRight } from "./icons";

/**
 * A titled row of products that scrolls sideways, as on Everli's store page: "Show all" and round arrows on the
 * right of the title (arrows from tablets up; phones swipe).
 */
export function ProductRow({
  title,
  href,
  linkLabel,
  products,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  products: ProductCardData[];
}) {
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

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-display text-xl leading-8 font-semibold md:text-2xl">{title}</h2>
        <div className="flex shrink-0 items-center gap-2">
          {href && linkLabel && (
            <Link href={href} className="mr-2 text-sm font-medium hover:underline">
              {linkLabel}
            </Link>
          )}
          <button type="button" onClick={() => scroll(-1)} disabled={edges.start} className="icon-btn hidden h-9 w-9 md:inline-flex" aria-label={t.catalog.prev}>
            <ChevronRight size={20} className="rotate-180" />
          </button>
          <button type="button" onClick={() => scroll(1)} disabled={edges.end} className="icon-btn hidden h-9 w-9 md:inline-flex" aria-label={t.catalog.next}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div ref={row} onScroll={update} className="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {products.map((product) => (
          <div key={product.id} className="grid w-[42vw] max-w-[200px] shrink-0 snap-start sm:w-[196px]">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
