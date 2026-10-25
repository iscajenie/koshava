import { createHash } from "node:crypto";
import { normalizeText, slugify } from "@/lib/text";

// Column names of the official price list ("Pravilnik o uslovima, sadržaju i načinu objavljivanja cenovnika").
const COL = {
  categoryCode: "KATEGORIJA",
  categoryName: "NAZIV KATEGORIJE",
  name: "Naziv proizvoda",
  brand: "Robna marka",
  barcode: "Barkod proizvoda",
  unit: "Jedinica mere",
  date: "Datum cenovnika",
  regular: "Redovna cena",
  unitPrice: "Cena po jedinici mere",
  sale: "Snižena cena",
  saleFrom: "Datum početka sniženja",
  saleTo: "Datum kraja sniženja",
  vat: "Stopa PDV",
  kind: "VRSTA_CENOVNIKA",
} as const;

export const CURRENT_LIST = "VAZECI_CENOVNIK";

// Placeholders Lidl uses instead of a real brand.
const NO_BRAND = new Set(["brend", "rm nije definisana", "sveze meso"]);

const UNIT_PRICE_LABEL: Record<string, string> = {
  g: "kg",
  kg: "kg",
  ml: "l",
  l: "l",
  "kom.": "kom",
  kom: "kom",
  "br.pranja": "pranje",
  "listić": "listić",
  m: "m",
};

export type PriceRow = {
  kind: string;
  /** nameKey of the name; import-prices adds "-2", "-3" for repeated names. */
  key: string;
  barcode: string | null;
  sourceName: string;
  name: string;
  brand: string | null;
  categoryCode: string;
  categoryName: string;
  unit: "kom" | "kg";
  soldByWeight: boolean;
  unitPriceLabel: string | null;
  vatRate: string | null;
  listDate: string;
  regularPriceMinor: number;
  priceMinor: number;
  unitPriceMinor: number | null;
  saleFrom: string | null;
  saleTo: string | null;
};

function toMinor(value: string) {
  if (!value) return null;
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** "24-10-2026" -> "2026-10-24". */
function toIsoDate(value: string) {
  const m = value.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** Strips shelf codes and duplicated sizes: "Avokado, 700g 700g" -> "Avokado, 700g". */
export function cleanName(raw: string) {
  let s = raw
    .replace(/\b[SM]K\d+\b/g, " ")
    .replace(/(\d)\s*Stk\.?/gi, "$1 kom")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/(\d+(?:[.,]\d+)?\s?(?:kg|g|ml|l|kom)\.?)\s+\1\.?$/i, "$1");
  s = s.replace(/,?\s*rinfuz\s+1\s?kg$/i, ", rinfuz");
  return s.replace(/\s+,/g, ",").trim();
}

/**
 * A product is identified by its price-list name: Lidl swaps the barcode of a name between variants
 * (flavours, suppliers) from day to day, while the name stays. Duplicate names get a suffix on import.
 */
export function nameKey(name: string) {
  return `n-${createHash("sha1").update(normalizeText(name)).digest("hex").slice(0, 12)}`;
}

export function productSlug(name: string, key: string) {
  return `${slugify(name)}-${key.slice(-6)}`;
}

export function parsePriceRow(r: Record<string, string>, today: string): PriceRow | null {
  const sourceName = r[COL.name];
  const regular = toMinor(r[COL.regular]);
  const listDate = toIsoDate(r[COL.date]);
  if (!sourceName || regular == null || !listDate) return null;

  const rawBarcode = r[COL.barcode]?.replace(/\D/g, "") ?? "";
  const barcode = /^0*$/.test(rawBarcode) ? null : rawBarcode;
  const soldByWeight = /\brinfuz\b/i.test(sourceName);
  const brand = r[COL.brand]?.trim();
  const unitKey = r[COL.unit]?.trim().toLowerCase();

  // A promotion counts only while it runs; the list also carries upcoming and finished ones.
  const sale = toMinor(r[COL.sale]);
  const saleFrom = toIsoDate(r[COL.saleFrom]);
  const saleTo = toIsoDate(r[COL.saleTo]);
  const saleActive = sale != null && sale < regular && (!saleFrom || saleFrom <= today) && (!saleTo || saleTo >= today);
  const unitPrice = toMinor(r[COL.unitPrice]);

  return {
    kind: r[COL.kind] ?? CURRENT_LIST,
    key: nameKey(sourceName),
    barcode,
    sourceName,
    name: cleanName(sourceName),
    brand: brand && !NO_BRAND.has(normalizeText(brand)) ? brand : null,
    categoryCode: r[COL.categoryCode] || "0",
    categoryName: r[COL.categoryName] || "Ostalo",
    unit: soldByWeight ? "kg" : "kom",
    soldByWeight,
    unitPriceLabel: soldByWeight ? null : (UNIT_PRICE_LABEL[unitKey] ?? unitKey ?? null),
    vatRate: r[COL.vat] || null,
    listDate,
    regularPriceMinor: regular,
    priceMinor: saleActive ? sale! : regular,
    unitPriceMinor:
      soldByWeight || unitPrice == null ? null : saleActive ? Math.round((unitPrice * sale!) / regular) : unitPrice,
    saleFrom: saleActive ? saleFrom : null,
    saleTo: saleActive ? saleTo : null,
  };
}

export function parseSisterBarcodes(rows: Record<string, string>[]) {
  const map = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a)!.add(b);
  };
  for (const r of rows) {
    const a = r.EANCODE?.replace(/\D/g, "");
    const b = r.SESTRINSKI_EAN?.replace(/\D/g, "");
    if (a && b && a !== b && !/^0*$/.test(a) && !/^0*$/.test(b)) {
      link(a, b);
      link(b, a);
    }
  }
  return map;
}
