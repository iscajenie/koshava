import type { Locale } from "@/i18n/config";

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: Locale) {
  const tag = locale === "sr" ? "sr-Latn-RS" : "ru-RU";
  let f = formatters.get(tag);
  if (!f) {
    f = new Intl.NumberFormat(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    formatters.set(tag, f);
  }
  return f;
}

export function formatAmount(minor: number, locale: Locale) {
  return formatter(locale).format(minor / 100);
}

export function formatPrice(minor: number, locale: Locale) {
  return `${formatAmount(minor, locale)} ${locale === "sr" ? "RSD" : "дин."}`;
}

export function lineTotal(priceMinor: number, qty: number) {
  return Math.round(priceMinor * qty);
}
