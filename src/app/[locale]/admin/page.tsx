import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { adminStats, listOrders, orderStatuses, type OrderStatus } from "@/lib/orders";
import { formatPrice } from "@/lib/money";
import { formatDate, formatDateTime, slotLabel } from "@/lib/format";
import { StatusBadge } from "@/components/order-details";

export default async function AdminOrdersPage({ searchParams }: PageProps<"/[locale]/admin">) {
  const { locale, t } = await getI18n();
  const raw = (await searchParams).status;
  const status = orderStatuses.includes(raw as OrderStatus) ? (raw as OrderStatus) : undefined;
  const [orders, stats] = await Promise.all([listOrders(status), adminStats()]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          [t.admin.stats.orders, String(stats.orders)],
          [t.admin.stats.revenue, formatPrice(stats.revenueMinor, locale)],
          [t.admin.stats.avg, formatPrice(stats.avgMinor, locale)],
          [t.admin.stats.users, String(stats.users)],
          [t.admin.stats.carts, String(stats.carts)],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <div className="text-xs font-medium text-muted">{label}</div>
            <div className="mt-1 text-xl font-extrabold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        <Link href={`/${locale}/admin`} className={`rounded px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${!status ? "bg-ink text-white" : "bg-white"}`}>
          {t.admin.all}
        </Link>
        {orderStatuses.map((s) => (
          <Link
            key={s}
            href={`/${locale}/admin?status=${s}`}
            className={`rounded px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${status === s ? "bg-ink text-white" : "bg-white"}`}
          >
            {t.order.statuses[s]} {stats.byStatus[s] ? `· ${stats.byStatus[s]}` : ""}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface text-left text-xs text-muted uppercase">
            <tr>
              <th className="px-4 py-2.5">№</th>
              <th className="px-4 py-2.5">{t.admin.date}</th>
              <th className="px-4 py-2.5">{t.admin.customer}</th>
              <th className="px-4 py-2.5">{t.order.deliveryAt}</th>
              <th className="px-4 py-2.5">{t.order.status}</th>
              <th className="px-4 py-2.5 text-right">{t.admin.total}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-brand-light/40">
                <td className="px-4 py-3 font-semibold">
                  <Link href={`/${locale}/admin/orders/${o.id}`} className="text-brand hover:underline" data-testid="admin-order-link">
                    {o.number}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatDateTime(o.createdAt, locale)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{o.customerName}</div>
                  <div className="text-muted">{o.phone}</div>
                </td>
                <td className="px-4 py-3">
                  {formatDate(o.deliveryDate, locale)}, {slotLabel(o.deliverySlot)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} t={t} />
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPrice(o.totalMinor, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="p-6 text-center text-muted">{t.account.noOrders}</p>}
      </div>
    </div>
  );
}
