import { getI18n } from "@/i18n/server";
import { Overlay } from "@/components/overlay";
import { CartPanel } from "@/components/cart-panel";

/** The cart opened from the header: a panel sliding in from the right over the current page. */
export default async function CartDrawer() {
  const { t } = await getI18n();
  return (
    <Overlay variant="panel" closeLabel={t.nav.close}>
      <CartPanel />
    </Overlay>
  );
}
