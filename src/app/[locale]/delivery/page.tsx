import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n";
import { shop } from "@/config/shop";
import { formatPrice } from "@/lib/money";
import { slotLabel } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.delivery.title };
}

export default async function DeliveryPage() {
  const { locale, t } = await getI18n();
  const values = {
    min: formatPrice(shop.minOrderMinor, locale),
    rate: `${Math.round(shop.deliveryFeeRate * 100)}%`,
    slots: shop.deliverySlots.map(slotLabel).join(", "),
    cutoff: shop.sameDayCutoffHour,
  };
  return (
    <div className="card mx-auto max-w-2xl p-6 md:p-8">
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{t.delivery.title}</h1>
      <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed">
        {t.delivery.lines.map((line) => (
          <li key={line}>{fmt(line, values)}</li>
        ))}
      </ul>
    </div>
  );
}
