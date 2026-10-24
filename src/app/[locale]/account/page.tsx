import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getI18n } from "@/i18n/server";
import { logout } from "@/actions/auth";
import { getCurrentUser } from "@/lib/auth/session";
import { listUserOrders } from "@/lib/orders";
import { formatAddress } from "@/lib/address";
import { formatDate, formatDateTime, slotLabel } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { AddressActions, ProfileForm } from "@/components/account-forms";
import { StatusBadge } from "@/components/order-details";
import { ChevronRight } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.title };
}

export default async function AccountPage() {
  const { locale, t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/account`);
  const [orders, addresses] = await Promise.all([
    listUserOrders(user.id),
    db
      .select()
      .from(schema.addresses)
      .where(eq(schema.addresses.userId, user.id))
      .orderBy(desc(schema.addresses.isDefault), desc(schema.addresses.createdAt)),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t.account.title}</h1>
        <div className="flex items-center gap-3">
          {user.role === "admin" && (
            <Link href={`/${locale}/admin`} className="btn-secondary px-4 py-2">
              {t.nav.admin}
            </Link>
          )}
          <form action={logout}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="text-sm font-medium text-muted hover:text-sale" data-testid="logout">
              {t.nav.logout}
            </button>
          </form>
        </div>
      </div>

      <section className="card p-5" id="orders">
        <h2 className="mb-3 text-lg font-bold">{t.account.orders}</h2>
        {orders.length === 0 ? (
          <p className="text-muted">{t.account.noOrders}</p>
        ) : (
          <ul className="divide-y divide-line">
            {orders.map((o) => (
              <li key={o.number}>
                <Link href={`/${locale}/orders/${o.number}`} className="flex items-center gap-3 py-3 hover:text-brand">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-semibold">
                      {o.number} <StatusBadge status={o.status} t={t} />
                    </div>
                    <div className="text-sm text-muted">
                      {formatDateTime(o.createdAt, locale)} · {t.order.deliveryAt.toLowerCase()} {formatDate(o.deliveryDate, locale)},{" "}
                      {slotLabel(o.deliverySlot)}
                    </div>
                  </div>
                  <div className="font-bold tabular-nums">{formatPrice(o.totalMinor, locale)}</div>
                  <ChevronRight size={18} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-bold">{t.account.profile}</h2>
        <ProfileForm name={user.name ?? ""} phone={user.phone ?? ""} email={user.email} />
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-bold">{t.account.addresses}</h2>
        {addresses.length === 0 ? (
          <p className="text-muted">{t.account.noAddresses}</p>
        ) : (
          <ul className="divide-y divide-line">
            {addresses.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-[15px]">{formatAddress(a.fields, t)}</div>
                  {a.isDefault && <div className="text-xs font-semibold text-brand">{t.account.default}</div>}
                </div>
                <AddressActions id={a.id} isDefault={a.isDefault} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
