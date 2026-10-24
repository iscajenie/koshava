import type { Locale } from "@/i18n/config";

const UNIT_RU: Record<string, string> = {
  kom: "шт.",
  kg: "кг",
  g: "г",
  l: "л",
  ml: "мл",
  m: "м",
  pranje: "стирка",
  "listić": "лист",
};

export function unitLabel(unit: string | null | undefined, locale: Locale) {
  if (!unit) return locale === "ru" ? "шт." : "kom";
  const key = unit.trim().toLowerCase();
  return locale === "ru" ? (UNIT_RU[key] ?? key) : key;
}

export function formatDate(day: string | Date, locale: Locale, withYear = false) {
  const date = typeof day === "string" ? new Date(`${day.slice(0, 10)}T12:00:00Z`) : day;
  return new Intl.DateTimeFormat(locale === "sr" ? "sr-Latn-RS" : "ru-RU", {
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "Europe/Belgrade",
  }).format(date);
}

export function formatDateTime(value: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "sr" ? "sr-Latn-RS" : "ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Belgrade",
  }).format(value);
}

export function formatQty(qty: number, unit: string | null, locale: Locale) {
  const n = new Intl.NumberFormat(locale === "sr" ? "sr-Latn-RS" : "ru-RU", { maximumFractionDigits: 3 }).format(qty);
  return `${n} ${unitLabel(unit, locale)}`;
}

export function discountPercent(priceMinor: number, regularPriceMinor: number) {
  if (regularPriceMinor <= priceMinor) return 0;
  return Math.round(((regularPriceMinor - priceMinor) / regularPriceMinor) * 100);
}

export function slotLabel(slot: string) {
  const [from, to] = slot.split("-");
  return `${from}:00–${to}:00`;
}
