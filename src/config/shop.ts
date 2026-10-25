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
  // "card" (card to the courier) needs a mobile POS terminal; add it back once the courier has one.
  paymentMethods: ["cash"],
} as const;

// Delivery zone: Belgrade's urban municipalities, named as couriers read them.
export const municipalities = [
  "Čukarica",
  "Novi Beograd",
  "Palilula",
  "Rakovica",
  "Savski venac",
  "Stari grad",
  "Voždovac",
  "Vračar",
  "Zemun",
  "Zvezdara",
] as const;

export const municipalityValues: readonly string[] = municipalities;

export function deliveryFeeFor(subtotalMinor: number) {
  return Math.round(subtotalMinor * shop.deliveryFeeRate);
}
