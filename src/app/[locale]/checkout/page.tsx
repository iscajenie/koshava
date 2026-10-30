import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { cartTotals, getCartLines } from "@/lib/cart";
import { deliveryOptions } from "@/lib/delivery";
import { formatPrice } from "@/lib/money";
import { formatQty } from "@/lib/format";
import { CheckoutForm } from "@/components/checkout-form";
import { OrderSummary } from "@/components/order-summary";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.checkout.title };
}

export default async function CheckoutPage() {
  const { locale, t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/checkout`);

  const lines = (await getCartLines()).filter((l) => l.available);
  const totals = cartTotals(lines);
  if (lines.length === 0 || !totals.meetsMinimum || totals.exceedsMaximum) redirect(`/${locale}/cart`);

  const addresses = await db
    .select({ id: schema.addresses.id, fields: schema.addresses.fields, isDefault: schema.addresses.isDefault })
    .from(schema.addresses)
    .where(eq(schema.addresses.userId, user.id))
    .orderBy(desc(schema.addresses.isDefault), desc(schema.addresses.createdAt));

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="mb-5 text-2xl font-extrabold tracking-tight md:text-3xl">{t.checkout.title}</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <CheckoutForm defaults={{ name: user.name ?? "", phone: user.phone ?? "" }} addresses={addresses} days={deliveryOptions()} />
        <aside className="space-y-3 lg:sticky lg:top-32 lg:self-start">
          <OrderSummary locale={locale} t={t} {...totals}>
            <details className="border-t border-line pt-3 text-sm" open={lines.length <= 6}>
              <summary className="cursor-pointer font-semibold">{t.checkout.summary} · {lines.length}</summary>
              <ul className="mt-2 space-y-1.5">
                {lines.map((l) => (
                  <li key={l.productId} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {l.name} <span className="text-muted">× {formatQty(l.qty, l.unit, locale)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatPrice(l.lineTotalMinor, locale)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </OrderSummary>
        </aside>
      </div>
    </div>
  );
}
