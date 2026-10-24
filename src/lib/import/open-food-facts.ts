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

// One shared schedule for all concurrent lookups: at most ~80 requests/min (the API allows 100).
let nextSlot = 0;
async function takeSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + 750;
  if (slot > now) await sleep(slot - now);
}

/** Looks up a barcode; null when the product is unknown or has no photo. */
export async function lookupBarcode(source: OpenFactsSource, barcode: string, attempt = 0): Promise<OpenFactsProduct | null> {
  await takeSlot();
  const res = await fetch(`${HOSTS[source]}/api/v2/product/${barcode}.json?fields=${FIELDS}`, {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 404) return null;
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 2) throw new Error(`${source} ${res.status} for ${barcode}`);
    if (res.status === 429) {
      console.warn(`${source}: rate limited, pausing 30 s`);
      nextSlot = Math.max(nextSlot, Date.now() + 30_000);
    } else await sleep(3000);
    return lookupBarcode(source, barcode, attempt + 1);
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
