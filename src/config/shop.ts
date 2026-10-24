// Business rules of the pilot. Amounts are in para (1 RSD = 100 para).
export const shop = {
  name: "Koshava",
  city: "Beograd",
  currency: "RSD",
  minOrderMinor: 5000_00,
  deliveryFeeRate: 0.1,
  timeZone: "Europe/Belgrade",
  deliveryDaysAhead: 5,
  // Same-day delivery is offered only for orders placed before this hour.
  sameDayCutoffHour: 14,
  deliverySlots: ["10-13", "13-16", "16-19", "19-22"],
  // Weighed goods are added in steps of this many kilograms.
  weightStepKg: 0.5,
} as const;

export function deliveryFeeFor(subtotalMinor: number) {
  return Math.round(subtotalMinor * shop.deliveryFeeRate);
}
