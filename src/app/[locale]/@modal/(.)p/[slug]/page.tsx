import { getI18n } from "@/i18n/server";
import { Overlay } from "@/components/overlay";
import { ProductDetail } from "@/components/product-detail";

/** A product opened from the shop: the same content as /p/[slug], in a dialog over the page. */
export default async function ProductDialog({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { t } = await getI18n();
  return (
    <Overlay variant="dialog" closeLabel={t.nav.close}>
      <ProductDetail slug={(await params).slug} variant="dialog" />
    </Overlay>
  );
}
