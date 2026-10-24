import { shop } from "@/config/shop";

function belgradeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: shop.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type DeliveryDay = { date: string; offset: number; slots: string[] };

/** Delivery days and slots available right now, in Belgrade time. */
export function deliveryOptions(now = new Date()): DeliveryDay[] {
  const { day, hour } = belgradeParts(now);
  const days: DeliveryDay[] = [];
  for (let offset = 0; offset < shop.deliveryDaysAhead; offset++) {
    const slots =
      offset === 0
        ? hour < shop.sameDayCutoffHour
          ? shop.deliverySlots.filter((s) => Number(s.split("-")[0]) >= hour + 3)
          : []
        : [...shop.deliverySlots];
    if (slots.length > 0) days.push({ date: addDays(day, offset), offset, slots });
  }
  return days;
}

export function isValidSlot(date: string, slot: string, now = new Date()) {
  return deliveryOptions(now).some((d) => d.date === date && d.slots.includes(slot));
}
