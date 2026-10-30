import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n";
import { shop } from "@/config/shop";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { formatDate, unitLabel } from "@/lib/format";
import { PriceTag } from "./price-tag";
import { BuyBox } from "./add-to-cart";
import { FavoriteButton } from "./favorite-button";
import { ProductGallery } from "./product-gallery";
import { isStockPhoto } from "./product-image";
import { ProductRow } from "./product-row";
import { ChevronRight } from "./icons";

/**
 * Everything about one product: photos on the left, a card with name, price and the buying row on the right,
 * then description, details and more products of the category. Shown as a page (/p/[slug]) and, opened from the
 * shop, inside a dialog over it (@modal/(.)p/[slug]).
 */
export async function ProductDetail({ slug, variant }: { slug: string; variant: "page" | "dialog" }) {
  const { locale, t } = await getI18n();
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [category] = product.categoryId
    ? await db.select().from(schema.categories).where(eq(schema.categories.id, product.categoryId)).limit(1)
    : [];
  const categoryName = category ? ((locale === "ru" ? category.nameRu : null) ?? category.nameSr) : null;
  const related = await getRelatedProducts(product.categoryId, product.id, 12);
  const images = product.images.length > 0 ? product.images : product.imageUrl ? [product.imageUrl] : [];
  const onSale = product.priceMinor < product.regularPriceMinor;
  const lines = (product.description ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <div className={variant === "dialog" ? "space-y-8 px-4 pt-16 pb-6 md:px-6 md:pt-6" : "space-y-10"}>
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-subtle md:pr-14" aria-label="breadcrumbs">
        <Link href={`/${locale}/catalog`} className="hover:text-ink hover:underline">
          {t.nav.catalog}
        </Link>
        {category && (
          <>
            <ChevronRight size={14} />
            <Link href={`/${locale}/catalog/${category.slug}`} className="hover:text-ink hover:underline">
              {categoryName}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        <ProductGallery
          images={images}
          alt={product.name}
          stockPhoto={
            isStockPhoto(product.contentSource)
              ? {
                  label: t.product.stockPhoto,
                  hint: product.contentSource === "maxi" ? t.product.stockPhotoHintMaxi : t.product.stockPhotoHint,
                  source: product.photoSource ? fmt(t.product.photoFrom, { source: product.photoSource }) : undefined,
                }
              : undefined
          }
        />
        <div className="space-y-6">
          <div className="relative rounded-3xl border border-line p-5 md:p-6">
            <FavoriteButton productId={product.id} variant="plain" className="absolute top-4 right-4 md:top-5 md:right-5" />
            {product.brand && <div className="pr-12 text-sm font-medium text-subtle">{product.brand}</div>}
            <h1 className="mt-1 pr-12 font-display text-2xl leading-8 font-semibold md:text-[28px] md:leading-9">{product.name}</h1>
            <PriceTag
              size="lg"
              showBadge
              priceMinor={product.priceMinor}
              regularPriceMinor={product.regularPriceMinor}
              unit={product.unit}
              unitPriceMinor={product.unitPriceMinor}
              unitPriceLabel={product.unitPriceLabel}
              locale={locale}
              className="mt-4"
            />
            {onSale && (product.saleFrom || product.saleTo) && (
              <div className="mt-2 text-sm font-medium text-sale">
                {product.saleFrom && product.saleTo
                  ? fmt(t.product.saleFromTo, { from: formatDate(product.saleFrom, locale), to: formatDate(product.saleTo, locale) })
                  : fmt(t.product.saleUntil, { date: formatDate(product.saleTo ?? product.saleFrom!, locale) })}
              </div>
            )}
            <div className="mt-5">
              <BuyBox productId={product.id} priceMinor={product.priceMinor} soldByWeight={product.soldByWeight} unit={product.unit} />
            </div>
            {product.soldByWeight && <p className="mt-3 text-xs text-muted">{fmt(t.product.weightNote, { step: shop.weightStepKg })}</p>}
          </div>

          {lines.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-lg font-semibold">{t.product.description}</h2>
              <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
                {lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 font-display text-lg font-semibold">{t.product.details}</h2>
            <dl className="divide-y divide-line rounded-2xl border border-line text-sm">
              {[
                [t.product.brand, product.brand],
                [t.product.category, categoryName],
                [t.product.unit, unitLabel(product.unit, locale)],
                [t.product.barcode, product.barcode],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-3">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
            </dl>
            <p className="mt-2 space-x-2 text-xs text-muted">
              {product.priceListDate && <span>{fmt(t.product.source, { date: formatDate(product.priceListDate, locale, true) })}</span>}
              {product.contentSource === "lidl" && product.lidlUrl && (
                <a href={product.lidlUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {t.product.photoLidl}
                </a>
              )}
              {product.contentSource === "maxi" && <span>{t.product.photoMaxi}</span>}
              {product.contentSource === "off" && product.barcode && (
                <a href={`https://world.openfoodfacts.org/product/${product.barcode}`} target="_blank" rel="noopener noreferrer" className="underline">
                  {t.product.photoOff}
                </a>
              )}
            </p>
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <ProductRow
          title={t.product.similar}
          href={category ? `/${locale}/catalog/${category.slug}` : undefined}
          linkLabel={t.home.showAll}
          products={related}
        />
      )}
    </div>
  );
}
