import { sleep } from "./fetch";

// Open Food Facts and its sister databases (cosmetics, other products). Data: ODbL, images: CC BY-SA.
const HOSTS = {
  off: "https://world.openfoodfacts.org",
  obf: "https://world.openbeautyfacts.org",
  opf: "https://world.openproductsfacts.org",
} as const;
export type OpenFactsSource = keyof typeof HOSTS;

const FIELDS = [
  "code",
  "product_name",
  "product_name_sr",
  "product_name_hr",
  "generic_name",
  "generic_name_sr",
  "quantity",
  "brands",
  "image_front_url",
  "image_url",
  "ingredients_text_sr",
  "ingredients_text_hr",
  "ingredients_text_bs",
  "ingredients_text_en",
].join(",");

export type OpenFactsProduct = {
  image: string;
  name: string | null;
  quantity: string | null;
  ingredients: string | null;
};

const userAgent = process.env.OFF_USER_AGENT ?? "Koshava/0.1 (pilot grocery delivery in Belgrade)";
let lastRequest = 0;

/** Looks up a barcode; null when the product is unknown or has no photo. Throttled to stay under 100 requests/min. */
export async function lookupBarcode(source: OpenFactsSource, barcode: string): Promise<OpenFactsProduct | null> {
  const wait = lastRequest + 700 - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  const res = await fetch(`${HOSTS[source]}/api/v2/product/${barcode}.json?fields=${FIELDS}`, {
    headers: { "User-Agent": userAgent },
  });
  if (res.status === 404) return null;
  if (res.status === 429) {
    await sleep(60_000);
    return lookupBarcode(source, barcode);
  }
  if (!res.ok) throw new Error(`${source} ${res.status} for ${barcode}`);
  const body = (await res.json()) as { status?: number; product?: Record<string, string | undefined> };
  const p = body.product;
  if (body.status !== 1 || !p) return null;
  const image = p.image_front_url || p.image_url;
  if (!image) return null;
  return {
    image,
    name: p.product_name_sr || p.product_name_hr || p.product_name || null,
    quantity: p.quantity || null,
    ingredients: p.ingredients_text_sr || p.ingredients_text_hr || p.ingredients_text_bs || p.ingredients_text_en || null,
  };
}

/** Which databases to ask for a price-list category: food first, cosmetics and household goods for non-food. */
export function sourcesForCategory(code: string | null): OpenFactsSource[] {
  if (code === "21" || code === "23") return ["obf", "off", "opf"];
  if (code === "19" || code === "20") return ["opf", "obf"];
  return ["off"];
}
