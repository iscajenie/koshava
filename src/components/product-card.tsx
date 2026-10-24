"use client";

import Link from "next/link";
import type { ProductCardData } from "@/lib/catalog";
import { fmt } from "@/i18n";
import { formatDate } from "@/lib/format";
import { useShop } from "./shop-provider";
import { PriceTag } from "./price-tag";
import { QtyControl } from "./qty-control";
import { FavoriteButton } from "./favorite-button";
import { ProductImage } from "./product-image";

export function ProductCard({ product }: { product: ProductCardData }) {
  const { locale, t } = useShop();
  const href = `/${locale}/p/${product.slug}`;
  const onSale = product.priceMinor < product.regularPriceMinor;
  return (
    <article className="card group relative flex flex-col overflow-hidden" data-testid="product-card">
      <FavoriteButton productId={product.id} className="absolute top-2 right-2 z-10" />
      <Link href={href} className="block bg-white p-3">
        <div className="aspect-square">
          <ProductImage src={product.imageUrl} alt={product.name} className="transition group-hover:scale-[1.03]" />
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 px-3 pb-3">
        {product.brand && <div className="text-xs font-semibold tracking-wide text-muted uppercase">{product.brand}</div>}
        <Link href={href} className="line-clamp-2 min-h-[2.6em] text-[15px] leading-snug font-medium hover:text-brand">
          {product.name}
        </Link>
        <div className="mt-auto">
          <PriceTag
            priceMinor={product.priceMinor}
            regularPriceMinor={product.regularPriceMinor}
            unit={product.unit}
            unitPriceMinor={product.unitPriceMinor}
            unitPriceLabel={product.unitPriceLabel}
            locale={locale}
          />
          {onSale && product.saleTo && (
            <div className="mt-1 text-xs font-medium text-sale">
              {fmt(t.product.saleUntil, { date: formatDate(product.saleTo, locale) })}
            </div>
          )}
        </div>
        <QtyControl productId={product.id} soldByWeight={product.soldByWeight} unit={product.unit} />
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
