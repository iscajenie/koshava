import type { AddressFields } from "@/db/schema";
import { fmt, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { formatAddress } from "@/lib/address";
import { formatPrice } from "@/lib/money";
import { formatDate, formatQty, slotLabel } from "@/lib/format";

export type OrderForMessage = {
  number: string | null;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  customerName: string;
  phone: string;
  address: AddressFields;
  deliveryDate: string;
  deliverySlot: string;
  paymentMethod: string;
  comment: string | null;
  items: { name: string; unit: string | null; qty: number; lineTotalMinor: number }[];
};

// A Telegram message holds 4096 characters: longer orders list their first items and a count of the rest.
const MAX_ITEMS = 40;

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A new order as a Telegram message (HTML): what the courier needs at a glance, then the items and a link to the admin. */
export function orderMessage(order: OrderForMessage, t: Dictionary, locale: Locale, adminUrl: string) {
  const price = (minor: number) => formatPrice(minor, locale);
  const items = order.items
    .slice(0, MAX_ITEMS)
    .map((i) => `${formatQty(i.qty, i.unit, locale)} × ${escape(i.name)} — ${price(i.lineTotalMinor)}`);
  if (order.items.length > MAX_ITEMS) items.push(fmt(t.telegram.more, { n: order.items.length - MAX_ITEMS }));
  return [
    `<b>${escape(fmt(t.telegram.newOrder, { number: order.number ?? "" }))}</b>`,
    fmt(t.telegram.totals, { total: `<b>${price(order.totalMinor)}</b>`, subtotal: price(order.subtotalMinor), fee: price(order.deliveryFeeMinor) }),
    `${t.order.deliveryAt}: ${formatDate(order.deliveryDate, locale)}, ${slotLabel(order.deliverySlot)}`,
    "",
    `${escape(order.customerName)}, ${escape(order.phone)}`,
    escape(formatAddress(order.address, t)),
    `${t.checkout.payment}: ${order.paymentMethod === "card" ? t.checkout.paymentCard : t.checkout.paymentCash}`,
    ...(order.comment ? [`${t.checkout.comment}: ${escape(order.comment)}`] : []),
    "",
    `${t.order.items} (${order.items.length}):`,
    ...items,
    "",
    `<a href="${escape(adminUrl)}">${t.telegram.open}</a>`,
  ].join("\n");
}
