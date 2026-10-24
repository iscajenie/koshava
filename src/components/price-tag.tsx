import { formatAmount, formatPrice } from "@/lib/money";
import { discountPercent, unitLabel } from "@/lib/format";
import type { Locale } from "@/i18n/config";

export function PriceTag({
  priceMinor,
  regularPriceMinor,
  unit,
  unitPriceMinor,
  unitPriceLabel,
  locale,
  size = "md",
}: {
  priceMinor: number;
  regularPriceMinor: number;
  unit: string | null;
  unitPriceMinor?: number | null;
  unitPriceLabel?: string | null;
  locale: Locale;
  size?: "md" | "lg";
}) {
  const discount = discountPercent(priceMinor, regularPriceMinor);
  const currency = locale === "sr" ? "RSD" : "дин.";
  return (
    <div className="flex flex-col items-start gap-1">
      {discount > 0 && (
        <div className="flex items-center gap-2">
          <span className="rounded-sm bg-sale px-1.5 py-0.5 text-xs font-bold text-white">−{discount}%</span>
          <span className="text-sm text-muted line-through">{formatAmount(regularPriceMinor, locale)}</span>
        </div>
      )}
      <div
        className={`inline-flex items-baseline gap-1 rounded-sm px-1.5 ${discount > 0 ? "bg-accent" : ""} ${
          discount > 0 ? "" : "-ml-1.5"
        }`}
      >
        <span className={`price-figure ${size === "lg" ? "text-4xl" : "text-2xl"}`}>{formatAmount(priceMinor, locale)}</span>
        <span className="text-xs font-semibold">
          {currency}
          {unit === "kg" ? `/${unitLabel(unit, locale)}` : ""}
        </span>
      </div>
      {unitPriceMinor != null && unitPriceLabel && unitPriceMinor !== priceMinor && (
        <span className="text-xs text-muted">
          {formatPrice(unitPriceMinor, locale)} / {unitLabel(unitPriceLabel, locale)}
        </span>
      )}
    </div>
  );
}
