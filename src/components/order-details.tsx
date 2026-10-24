import Link from "next/link";
import type { Dictionary } from "@/i18n";
import { fmt } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { OrderWithItems } from "@/lib/orders";
import { formatPrice } from "@/lib/money";
import { formatAddress } from "@/lib/address";
import { formatDate, formatDateTime, formatQty, slotLabel } from "@/lib/format";
import { OrderSummary } from "./order-summary";
import { ProductImage } from "./product-image";

const statusStyle: Record<string, string> = {
  new: "bg-accent text-ink",
  confirmed: "bg-brand-light text-brand-dark",
  assembling: "bg-brand-light text-brand-dark",
  delivering: "bg-brand text-white",
  delivered: "bg-success text-white",
  cancelled: "bg-line text-muted",
};

export function StatusBadge({ status, t }: { status: string; t: Dictionary }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${statusStyle[status] ?? ""}`} data-testid="order-status">
      {t.order.statuses[status as keyof Dictionary["order"]["statuses"]] ?? status}
    </span>
  );
}

export function OrderDetails({ order, locale, t }: { order: OrderWithItems; locale: Locale; t: Dictionary }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="card divide-y divide-line">
        <h2 className="p-4 text-lg font-bold">{t.order.items}</h2>
        {order.items.map((item) => (
          <div key={item.productId} className="flex items-center gap-3 p-4">
            <div className="h-14 w-14 shrink-0">
              <ProductImage src={item.imageUrl} alt="" />
            </div>
            <div className="min-w-0 flex-1">
              {item.slug ? (
                <Link href={`/${locale}/p/${item.slug}`} className="line-clamp-2 font-medium hover:text-brand">
                  {item.name}
                </Link>
              ) : (
                <span className="font-medium">{item.name}</span>
              )}
              <div className="text-sm text-muted">
                {formatQty(item.qty, item.unit, locale)} × {formatPrice(item.priceMinor, locale)}
              </div>
            </div>
            <div className="font-semibold whitespace-nowrap tabular-nums">{formatPrice(item.lineTotalMinor, locale)}</div>
          </div>
        ))}
      </section>
      <aside className="space-y-3">
        <div className="card space-y-3 p-5 text-[15px]">
          <div className="flex items-center justify-between">
            <span className="text-muted">{t.order.status}</span>
            <StatusBadge status={order.status} t={t} />
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted">{t.order.createdAt}</span>
            <span className="text-right">{formatDateTime(order.createdAt, locale)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted">{t.order.deliveryAt}</span>
            <span className="text-right font-semibold">
              {formatDate(order.deliveryDate, locale)}, {slotLabel(order.deliverySlot)}
            </span>
          </div>
          <div className="border-t border-line pt-3">
            <div className="font-semibold">{order.customerName}</div>
            <div className="text-muted">{order.phone}</div>
            <div className="mt-1">{formatAddress(order.address, t)}</div>
            {order.comment && <div className="mt-2 rounded bg-surface p-2 text-sm">{order.comment}</div>}
          </div>
          <div className="text-sm text-muted">
            {t.checkout.payment}: {order.paymentMethod === "card" ? t.checkout.paymentCard : t.checkout.paymentCash}
          </div>
        </div>
        <OrderSummary locale={locale} t={t} subtotalMinor={order.subtotalMinor} deliveryFeeMinor={order.deliveryFeeMinor} totalMinor={order.totalMinor} />
      </aside>
    </div>
  );
}

export function orderTitle(t: Dictionary, number: string | null) {
  return fmt(t.order.number, { number: number ?? "" });
}
