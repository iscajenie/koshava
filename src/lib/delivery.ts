import { shop } from "@/config/shop";

function belgradeDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: shop.timeZone }).format(date);
}

function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type DeliveryDay = { date: string; offset: number; slots: string[] };

/** Delivery days and slots available right now, in Belgrade time. */
export function deliveryOptions(now = new Date()): DeliveryDay[] {
  const today = belgradeDay(now);
  const days: DeliveryDay[] = [];
  for (let offset = shop.firstDeliveryOffsetDays; offset < shop.firstDeliveryOffsetDays + shop.deliveryDaysAhead; offset++) {
    days.push({ date: addDays(today, offset), offset, slots: [...shop.deliverySlots] });
  }
  return days;
}

export function isValidSlot(date: string, slot: string, now = new Date()) {
  return deliveryOptions(now).some((d) => d.date === date && d.slots.includes(slot));
}
