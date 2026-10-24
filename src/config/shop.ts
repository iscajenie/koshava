// Business rules of the pilot. Amounts are in para (1 RSD = 100 para).
export const shop = {
  name: "Koshava",
  city: "Beograd",
  currency: "RSD",
  minOrderMinor: 5000_00,
  maxOrderMinor: 30000_00,
  deliveryFeeRate: 0.1,
  timeZone: "Europe/Belgrade",
  // One delivery run a day; orders are delivered from the next day on.
  firstDeliveryOffsetDays: 1,
  deliveryDaysAhead: 5,
  // Slot values are "HH" (a run starting at that hour) or "HH-HH" (a window).
  deliverySlots: ["10"],
  // Weighed goods are added in steps of this many kilograms.
  weightStepKg: 0.5,
} as const;

// Belgrade's 17 city municipalities, values as couriers read them; labels in Russian.
export const municipalities = [
  { value: "Vračar", ru: "Врачар", group: "city" },
  { value: "Stari grad", ru: "Стари-Град", group: "city" },
  { value: "Savski venac", ru: "Савски-Венац", group: "city" },
  { value: "Palilula", ru: "Палилула", group: "city" },
  { value: "Zvezdara", ru: "Звездара", group: "city" },
  { value: "Voždovac", ru: "Вождовац", group: "city" },
  { value: "Čukarica", ru: "Чукарица", group: "city" },
  { value: "Rakovica", ru: "Раковица", group: "city" },
  { value: "Novi Beograd", ru: "Нови-Београд", group: "city" },
  { value: "Zemun", ru: "Земун", group: "city" },
  { value: "Surčin", ru: "Сурчин", group: "suburb" },
  { value: "Grocka", ru: "Гроцка", group: "suburb" },
  { value: "Barajevo", ru: "Бараево", group: "suburb" },
  { value: "Sopot", ru: "Сопот", group: "suburb" },
  { value: "Obrenovac", ru: "Обреновац", group: "suburb" },
  { value: "Lazarevac", ru: "Лазаревац", group: "suburb" },
  { value: "Mladenovac", ru: "Младеновац", group: "suburb" },
] as const;

export const municipalityValues: readonly string[] = municipalities.map((m) => m.value);

export function deliveryFeeFor(subtotalMinor: number) {
  return Math.round(subtotalMinor * shop.deliveryFeeRate);
}
