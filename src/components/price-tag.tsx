import { formatAmount, formatPrice } from "@/lib/money";
import { discountPercent, unitLabel } from "@/lib/format";
import type { Locale } from "@/i18n/config";

/** Price as on Everli: a discounted price sits on a yellow highlight next to the struck-out regular one. */
export function PriceTag({
  priceMinor,
  regularPriceMinor,
  unit,
  unitPriceMinor,
  unitPriceLabel,
  locale,
  size = "md",
  showBadge = false,
  className = "",
}: {
  priceMinor: number;
  regularPriceMinor: number;
  unit: string | null;
  unitPriceMinor?: number | null;
  unitPriceLabel?: string | null;
  locale: Locale;
  size?: "md" | "lg";
  showBadge?: boolean;
  className?: string;
}) {
  const discount = discountPercent(priceMinor, regularPriceMinor);
  const currency = locale === "sr" ? "RSD" : "дин.";
  const small = size === "lg" ? "text-sm" : "text-xs";
  return (
    <div className={`flex flex-col items-start ${className}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {showBadge && discount > 0 && <span className="rounded-full bg-sale px-1.5 py-0.5 text-sm font-medium text-white">−{discount}%</span>}
        <span className={`inline-flex items-baseline gap-1 ${discount > 0 ? "bg-accent px-0.5" : ""}`}>
          <span className={`price-figure ${size === "lg" ? "text-[28px] leading-9" : "text-xl leading-7"}`}>{formatAmount(priceMinor, locale)}</span>
          <span className={`${small} font-medium`}>
            {currency}
            {unit === "kg" ? `/${unitLabel(unit, locale)}` : ""}
          </span>
        </span>
        {discount > 0 && <span className={`${small} text-muted line-through`}>{formatAmount(regularPriceMinor, locale)}</span>}
      </div>
      {unitPriceMinor != null && unitPriceLabel && unitPriceMinor !== priceMinor && (
        <span className={`${small} mt-0.5 text-muted`}>
          {formatPrice(unitPriceMinor, locale)} / {unitLabel(unitPriceLabel, locale)}
        </span>
      )}
    </div>
  );
}
