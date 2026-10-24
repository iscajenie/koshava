import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrder } from "@/lib/orders";
import { OrderDetails } from "@/components/order-details";
import { CheckIcon } from "@/components/icons";

export const metadata: Metadata = { robots: { index: false } };

export default async function OrderPage({ params, searchParams }: PageProps<"/[locale]/orders/[number]">) {
  const { locale, t } = await getI18n();
  const { number } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/orders/${number}`);
  const order = await getOrder({ number });
  if (!order || (order.userId !== user.id && user.role !== "admin")) notFound();
  // Checkout redirects here with ?placed=1 to show the confirmation.
  const fresh = (await searchParams).placed === "1";

  return (
    <div className="space-y-6">
      {fresh ? (
        <div className="card flex items-start gap-4 border-success/40 p-5" data-testid="order-thanks">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success text-white">
            <CheckIcon />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{fmt(t.order.thanksTitle, { number: order.number ?? "" })}</h1>
            <p className="mt-1 text-muted">{fmt(t.order.thanksText, { phone: order.phone })}</p>
          </div>
        </div>
      ) : (
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{fmt(t.order.number, { number: order.number ?? "" })}</h1>
      )}
      <OrderDetails order={order} locale={locale} t={t} />
      <div className="flex flex-wrap gap-3">
        <Link href={`/${locale}/account#orders`} className="btn-secondary">
          {t.order.toAccount}
        </Link>
        <Link href={`/${locale}/catalog`} className="btn-primary">
          {t.order.continueShopping}
        </Link>
      </div>
    </div>
  );
}
