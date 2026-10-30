"use client";

import Link from "next/link";
import type { ProductCardData } from "@/lib/catalog";
import { fmt } from "@/i18n";
import { discountPercent, formatDate } from "@/lib/format";
import { useShop } from "./shop-provider";
import { PriceTag } from "./price-tag";
import { CardCartControl } from "./add-to-cart";
import { FavoriteButton } from "./favorite-button";
import { isStockPhoto, ProductImage, StockPhotoTag } from "./product-image";

/**
 * A product as on Everli: no frame, the photo with the discount badge and a round "+" over it, then brand, name
 * and price. The photo and the name open the product card over the page (app/[locale]/@modal/(.)p).
 */
export function ProductCard({ product }: { product: ProductCardData }) {
  const { locale, t } = useShop();
  const href = `/${locale}/p/${product.slug}`;
  const discount = discountPercent(product.priceMinor, product.regularPriceMinor);
  return (
    <article className="group relative flex flex-col" data-testid="product-card">
      <div className="relative">
        <Link href={href} scroll={false} className="block aspect-square" tabIndex={-1} aria-hidden>
          <ProductImage src={product.imageUrl} alt="" />
        </Link>
        {discount > 0 && (
          <span className="pointer-events-none absolute top-1 left-0 rounded-full bg-sale px-1.5 py-1 text-sm leading-5 font-medium text-white">
            −{discount}%
          </span>
        )}
        {isStockPhoto(product.contentSource) && (
          <StockPhotoTag
            label={t.product.stockPhoto}
            hint={product.contentSource === "maxi" ? t.product.stockPhotoHintMaxi : t.product.stockPhotoHint}
            source={product.photoSource ? fmt(t.product.photoFrom, { source: product.photoSource }) : undefined}
            className="absolute bottom-0 left-0 max-w-[calc(100%-40px)] truncate"
          />
        )}
        <FavoriteButton
          productId={product.id}
          className="absolute right-0 bottom-0 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 lg:data-[on=true]:opacity-100"
        />
        <div className="absolute top-0 right-0">
          <CardCartControl productId={product.id} priceMinor={product.priceMinor} soldByWeight={product.soldByWeight} unit={product.unit} />
        </div>
      </div>
      <div className="mt-3 flex flex-1 flex-col">
        {product.brand && <div className="truncate text-xs leading-[18px] font-medium text-muted">{product.brand}</div>}
        <Link href={href} scroll={false} className="line-clamp-2 text-sm leading-5 font-medium text-ink hover:underline">
          {product.name}
        </Link>
        <PriceTag
          priceMinor={product.priceMinor}
          regularPriceMinor={product.regularPriceMinor}
          unit={product.unit}
          unitPriceMinor={product.unitPriceMinor}
          unitPriceLabel={product.unitPriceLabel}
          locale={locale}
          className="mt-1.5"
        />
        {discount > 0 && product.saleTo && (
          <div className="mt-0.5 text-xs text-sale">{fmt(t.product.saleUntil, { date: formatDate(product.saleTo, locale) })}</div>
        )}
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(176px,1fr))]">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
