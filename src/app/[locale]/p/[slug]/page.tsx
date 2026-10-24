import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n";
import { shop } from "@/config/shop";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { formatDate, unitLabel } from "@/lib/format";
import { PriceTag } from "@/components/price-tag";
import { QtyControl } from "@/components/qty-control";
import { FavoriteButton } from "@/components/favorite-button";
import { ProductGallery } from "@/components/product-gallery";
import { ProductGrid } from "@/components/product-card";
import { SectionHeader } from "@/components/section-header";
import { ChevronRight } from "@/components/icons";

export async function generateMetadata({ params }: PageProps<"/[locale]/p/[slug]">): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description?.split("\n").slice(0, 3).join(" "),
    openGraph: product.imageUrl ? { images: [product.imageUrl] } : undefined,
  };
}

export default async function ProductPage({ params }: PageProps<"/[locale]/p/[slug]">) {
  const { locale, t } = await getI18n();
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const [category] = product.categoryId
    ? await db.select().from(schema.categories).where(eq(schema.categories.id, product.categoryId)).limit(1)
    : [];
  const categoryName = category ? ((locale === "ru" ? category.nameRu : null) ?? category.nameSr) : null;
  const related = await getRelatedProducts(product.categoryId, product.id, 5);
  const images = product.images.length > 0 ? product.images : product.imageUrl ? [product.imageUrl] : [];
  const onSale = product.priceMinor < product.regularPriceMinor;
  const lines = (product.description ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <div className="space-y-10">
      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted" aria-label="breadcrumbs">
        <Link href={`/${locale}/catalog`} className="hover:text-brand">
          {t.nav.catalog}
        </Link>
        {category && (
          <>
            <ChevronRight size={14} />
            <Link href={`/${locale}/catalog/${category.slug}`} className="hover:text-brand">
              {categoryName}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <ProductGallery
          images={images}
          alt={product.name}
          stockPhoto={product.contentSource === "off" ? { label: t.product.stockPhoto, hint: t.product.stockPhotoHint } : undefined}
        />
        <div className="space-y-5">
          <div>
            {product.brand && <div className="text-sm font-semibold tracking-wide text-muted uppercase">{product.brand}</div>}
            <h1 className="mt-1 text-2xl leading-tight font-extrabold tracking-tight md:text-3xl">{product.name}</h1>
          </div>
          <div className="card space-y-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <PriceTag
                size="lg"
                priceMinor={product.priceMinor}
                regularPriceMinor={product.regularPriceMinor}
                unit={product.unit}
                unitPriceMinor={product.unitPriceMinor}
                unitPriceLabel={product.unitPriceLabel}
                locale={locale}
              />
              <FavoriteButton productId={product.id} className="border border-line" />
            </div>
            {onSale && (product.saleFrom || product.saleTo) && (
              <div className="text-sm font-semibold text-sale">
                {product.saleFrom && product.saleTo
                  ? fmt(t.product.saleFromTo, { from: formatDate(product.saleFrom, locale), to: formatDate(product.saleTo, locale) })
                  : fmt(t.product.saleUntil, { date: formatDate(product.saleTo ?? product.saleFrom!, locale) })}
              </div>
            )}
            <QtyControl productId={product.id} soldByWeight={product.soldByWeight} unit={product.unit} size="lg" />
            {product.soldByWeight && <p className="text-xs text-muted">{fmt(t.product.weightNote, { step: shop.weightStepKg })}</p>}
          </div>

          {lines.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-bold">{t.product.description}</h2>
              <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
                {lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-lg font-bold">{t.product.details}</h2>
            <dl className="card divide-y divide-line text-sm">
              {[
                [t.product.brand, product.brand],
                [t.product.category, categoryName],
                [t.product.unit, unitLabel(product.unit, locale)],
                [t.product.barcode, product.barcode],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
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
        <section>
          <SectionHeader title={t.product.similar} href={category ? `/${locale}/catalog/${category.slug}` : undefined} linkLabel={t.home.showAll} />
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
