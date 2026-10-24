import { notFound } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n";
import { saveAdminNote } from "@/actions/admin";
import { getOrder } from "@/lib/orders";
import { OrderDetails } from "@/components/order-details";
import { OrderStatusButtons } from "@/components/admin-order-controls";

export default async function AdminOrderPage({ params }: PageProps<"/[locale]/admin/orders/[id]">) {
  const { locale, t } = await getI18n();
  const id = Number((await params).id);
  const order = Number.isInteger(id) ? await getOrder({ id }) : null;
  if (!order) notFound();
  return (
    <div className="space-y-5">
      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-extrabold">{fmt(t.order.number, { number: order.number ?? "" })}</h2>
          <a href={`mailto:${order.email}`} className="text-sm text-brand hover:underline">
            {order.email}
          </a>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold">{t.admin.changeStatus}</div>
          <OrderStatusButtons orderId={order.id} current={order.status} />
        </div>
        <form action={saveAdminNote} className="space-y-2">
          <input type="hidden" name="orderId" value={order.id} />
          <label className="label" htmlFor="note">{t.admin.note}</label>
          <textarea id="note" name="note" rows={2} defaultValue={order.adminNote ?? ""} className="field" />
          <button type="submit" className="btn-secondary px-4 py-2 text-sm">
            {t.admin.saveNote}
          </button>
        </form>
      </div>
      <OrderDetails order={order} locale={locale} t={t} />
    </div>
  );
}
