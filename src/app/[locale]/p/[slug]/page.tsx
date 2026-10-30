import type { Metadata } from "next";
import { getProductBySlug } from "@/lib/catalog";
import { ProductDetail } from "@/components/product-detail";

export async function generateMetadata({ params }: PageProps<"/[locale]/p/[slug]">): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description?.split("\n").slice(0, 3).join(" "),
    openGraph: product.imageUrl ? { images: [product.imageUrl] } : undefined,
  };
}

/** The product as a page: a shared link or a reload. Opened from the shop it shows as a dialog (@modal/(.)p). */
export default async function ProductPage({ params }: PageProps<"/[locale]/p/[slug]">) {
  return (
    <div className="mx-auto max-w-[1100px]">
      <ProductDetail slug={(await params).slug} variant="page" />
    </div>
  );
}
