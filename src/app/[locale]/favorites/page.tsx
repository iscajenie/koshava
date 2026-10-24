import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { getFavoriteIds } from "@/lib/favorites";
import { getProductsByIds } from "@/lib/catalog";
import { ProductGrid } from "@/components/product-card";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.favorites.title };
}

export default async function FavoritesPage() {
  const { locale, t } = await getI18n();
  const products = await getProductsByIds((await getFavoriteIds()).reverse());
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight md:text-3xl">{t.favorites.title}</h1>
      {products.length === 0 ? (
        <div className="card mx-auto max-w-lg p-10 text-center">
          <div className="text-lg font-bold">{t.favorites.empty}</div>
          <p className="mt-2 text-muted">{t.favorites.emptyText}</p>
          <Link href={`/${locale}/catalog`} className="btn-primary mt-6">
            {t.cart.goCatalog}
          </Link>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
