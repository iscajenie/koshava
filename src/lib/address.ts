import type { AddressFields } from "@/db/schema";
import type { Dictionary } from "@/i18n";

export function formatAddress(a: AddressFields, t: Dictionary) {
  const c = t.checkout;
  return [
    `${a.street} ${a.house}`,
    a.apartment && `${c.apartment.toLowerCase()} ${a.apartment}`,
    a.entrance && `${c.entrance.toLowerCase()} ${a.entrance}`,
    a.floor && `${c.floor.toLowerCase()} ${a.floor}`,
    a.intercom && `${c.intercom.toLowerCase()} ${a.intercom}`,
    a.municipality,
  ]
    .filter(Boolean)
    .join(", ");
}
