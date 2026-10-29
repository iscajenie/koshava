// Parsing of lidl.rs pages, sitemaps and search results; no network or database access, so it is unit-tested.
import type { LidlOffer } from "@/db/schema";

/** Record format of the earlier lidl.rs crawler, still present in content_cache rows (source "lidl"). */
export type LidlProduct = {
  erp: string;
  url: string;
  title: string;
  brand: string | null;
  images: string[];
  description: string[];
  gtins: string[];
};

export type LidlRecord = {
  erp: string;
  url: string;
  title: string;
  brand: string | null;
  category: string | null;
  gtins: string[];
  description: string | null;
  images: string[];
  offer: Omit<LidlOffer, "seenAt">;
};

function decodeEntities(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** "<ul><li>1 x 112 g</li><li>Bez glutena</li></ul>" -> ["1 x 112 g", "Bez glutena"]. */
export function htmlToLines(html: string | undefined | null): string[] {
  if (!html) return [];
  return decodeEntities(
    html
      .replace(/<\/(li|p|div|h\d)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0 && l.length < 400);
}

/** Every <loc> of a sitemap or sitemap index. */
export function sitemapLocations(xml: string) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => decodeEntities(m[1]));
}

export const LIDL_BASE = "https://www.lidl.rs";

export type LidlSite = { country: string; host: string; assortment: string; locale: string };

/**
 * Lidl online catalogs that answer the same search API, lidl.rs first, then by distance from Serbia:
 * neighbours often sell the same own-brand products, with the same barcode and similar packaging.
 * Bosnia and Herzegovina, Montenegro and North Macedonia are Lidl's next markets (stores from late 2026); their
 * catalogs are listed ahead, with the locales Lidl may choose, and join the search once they answer (see probeSite).
 * Not listed: Northern Ireland, which shows the GB catalog.
 */
export const LIDL_SITES: LidlSite[] = [
  ["rs", "www.lidl.rs", "sr_RS"],
  ["ba", "www.lidl.ba", "bs_BA"],
  ["ba", "www.lidl.ba", "sr_BA"],
  ["ba", "www.lidl.ba", "hr_BA"],
  ["me", "www.lidl.me", "sr_ME"],
  ["me", "www.lidl.me", "cnr_ME"],
  ["mk", "www.lidl.mk", "mk_MK"],
  ["hr", "www.lidl.hr", "hr_HR"],
  ["si", "www.lidl.si", "sl_SI"],
  ["bg", "www.lidl.bg", "bg_BG"],
  ["hu", "www.lidl.hu", "hu_HU"],
  ["ro", "www.lidl.ro", "ro_RO"],
  ["gr", "www.lidl-hellas.gr", "el_GR"],
  ["at", "www.lidl.at", "de_AT"],
  ["sk", "www.lidl.sk", "sk_SK"],
  ["cz", "www.lidl.cz", "cs_CZ"],
  ["de", "www.lidl.de", "de_DE"],
  ["pl", "www.lidl.pl", "pl_PL"],
  ["it", "www.lidl.it", "it_IT"],
  ["cy", "www.lidl.com.cy", "el_CY"],
  ["mt", "www.lidl.com.mt", "en_MT"],
  ["ch", "www.lidl.ch", "de_CH"],
  ["nl", "www.lidl.nl", "nl_NL"],
  ["be", "www.lidl.be", "nl_BE"],
  ["fr", "www.lidl.fr", "fr_FR"],
  ["es", "www.lidl.es", "es_ES"],
  ["pt", "www.lidl.pt", "pt_PT"],
  ["dk", "www.lidl.dk", "da_DK"],
  ["se", "www.lidl.se", "sv_SE"],
  ["fi", "www.lidl.fi", "fi_FI"],
  ["lt", "www.lidl.lt", "lt_LT"],
  ["lv", "www.lidl.lv", "lv_LV"],
  ["ee", "www.lidl.ee", "et_EE"],
  ["lu", "www.lidl.lu", "fr_LU"],
  ["gb", "www.lidl.co.uk", "en_GB"],
  ["ie", "www.lidl.ie", "en_IE"],
  ["us", "www.lidl.com", "en_US"],
].map(([country, host, locale]) => ({ country, host, locale, assortment: locale.slice(3) }));

/**
 * Lidl's internal barcodes (starting with 2: bread baked in the store, loose fruit, some own brands) are assigned by
 * each country, so abroad the same number can be another product (a Serbian croissant is a pain au chocolat in
 * France). They are trusted only in the neighbouring countries that share Serbia's assortment; GTINs everywhere.
 */
const SHARED_ASSORTMENT = new Set(["rs", "ba", "me", "mk", "hr", "si", "bg", "ro", "hu", "gr"]);
export function trustedAbroad(code: string, country: string) {
  const internal = code.startsWith("2") && (code.length === 8 || code.length === 13);
  return !internal || SHARED_ASSORTMENT.has(country);
}

/** Library key: lidl.rs products by their number, products from other countries as "<country>:<number>". */
export const libraryKey = (country: string, erp: string) => (country === "rs" ? erp : `${country}:${erp}`);

/**
 * One page of a Lidl search API answer (/q/api/search): products with their page URLs. With q=* it lists every
 * product currently on the site, including ones published today that reach the sitemap only with its nightly rebuild.
 */
export function parseSearchPage(json: unknown, base = LIDL_BASE) {
  const d = (json ?? {}) as { numFound?: number; items?: { gridbox?: { data?: { erpNumber?: string; canonicalUrl?: string } } }[] };
  const items = d.items ?? [];
  const products = items.flatMap((item) => {
    const g = item.gridbox?.data;
    return g?.erpNumber && g.canonicalUrl ? [{ erp: String(g.erpNumber), url: new URL(g.canonicalUrl, base).toString() }] : [];
  });
  return { numFound: Number(d.numFound ?? 0), count: items.length, products };
}

/**
 * Groups barcodes into search queries. The search finds any of several space-separated barcodes,
 * but rejects queries longer than 100 characters.
 */
export function searchBatches(codes: string[], maxLength = 100): string[][] {
  const batches: string[][] = [];
  let length = 0;
  for (const code of codes) {
    const last = batches[batches.length - 1];
    if (last && length + 1 + code.length <= maxLength) {
      last.push(code);
      length += 1 + code.length;
    } else {
      batches.push([code]);
      length = code.length;
    }
  }
  return batches;
}

/** "https://www.lidl.rs/p/nixe-tuna/p11000015" -> "11000015". */
export function erpFromUrl(url: string) {
  return url.match(/\/p(\d+)(?:[/?#]|$)/)?.[1] ?? null;
}

/** Resolves Nuxt's flattened payload (devalue format) into plain objects. */
export function resolveNuxtPayload(payload: unknown[]) {
  const memo = new Map<number, unknown>();
  const wrappers = new Set(["Reactive", "ShallowReactive", "Ref", "ShallowRef", "EmptyRef", "EmptyShallowRef"]);
  const resolve = (i: number, depth = 0): unknown => {
    if (depth > 80) return null;
    if (memo.has(i)) return memo.get(i);
    const v = payload[i];
    if (Array.isArray(v)) {
      if (typeof v[0] === "string" && wrappers.has(v[0])) {
        const out = typeof v[1] === "number" ? resolve(v[1], depth + 1) : null;
        memo.set(i, out);
        return out;
      }
      if (typeof v[0] === "string" && ["Set", "Map", "Date", "Error", "RegExp", "BigInt", "null", "NaN", "undefined"].includes(v[0])) {
        memo.set(i, null);
        return null;
      }
      const out: unknown[] = [];
      memo.set(i, out);
      for (const x of v) out.push(typeof x === "number" ? resolve(x, depth + 1) : x);
      return out;
    }
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      memo.set(i, out);
      for (const [k, idx] of Object.entries(v)) out[k] = typeof idx === "number" ? resolve(idx, depth + 1) : idx;
      return out;
    }
    memo.set(i, v);
    return v;
  };
  return resolve;
}

type NuxtProduct = {
  erpNumber?: string;
  fullTitle?: string;
  category?: string;
  eans?: string[];
  keyfacts?: { fullTitle?: string; title?: string; description?: string };
  media?: {
    gallery?: { images?: (number | string)[] };
    imageMap?: Record<string, { largeUrl?: string; mediumUrl?: string }>;
  };
  price?: { price?: number };
  regionsPrices?: Record<string, { currentPrice?: { price?: number; startDate?: string; endDate?: string; discount?: { discountText?: string } } }>;
  stockAvailability?: { badgeInfo?: { badges?: { text?: string }[] } };
};

/** A product page parsed into the fields the library keeps; null when it holds no product. */
export function parseLidlPage(erp: string, url: string, html: string): LidlRecord | null {
  let product: NuxtProduct | null = null;
  const nuxt = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nuxt) {
    const payload = JSON.parse(nuxt[1]) as unknown[];
    const resolve = resolveNuxtPayload(payload);
    const index = payload.findIndex((v) => v && typeof v === "object" && !Array.isArray(v) && "erpNumber" in v && "keyfacts" in v);
    if (index >= 0) product = resolve(index) as NuxtProduct;
  }

  // JSON-LD carries the GTINs, brand and description even if the payload layout changes.
  let ld: { gtin13?: string | string[]; name?: string; brand?: { name?: string }; description?: string; image?: string[] } = {};
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1]);
      if (d["@type"] === "Product") ld = d;
    } catch {
      // Not JSON we understand.
    }
  }
  if (!product && !ld.name) return null;

  const ldGtins = Array.isArray(ld.gtin13) ? ld.gtin13 : ld.gtin13 ? [ld.gtin13] : [];
  const gtins = [...new Set([...(product?.eans ?? []), ...ldGtins].map((g) => String(g).replace(/\D/g, "")).filter(Boolean))];
  const gallery = product?.media?.gallery?.images ?? [];
  const imageMap = product?.media?.imageMap ?? {};
  const images = gallery.map((id) => imageMap[String(id)]?.largeUrl ?? imageMap[String(id)]?.mediumUrl).filter((u): u is string => !!u);
  const current = product?.regionsPrices ? Object.values(product.regionsPrices)[0]?.currentPrice : undefined;
  const description = htmlToLines(product?.keyfacts?.description ?? ld.description);

  return {
    erp,
    url,
    title: product?.keyfacts?.fullTitle ?? product?.fullTitle ?? ld.name ?? "",
    brand: ld.brand?.name ?? null,
    category: product?.category ?? null,
    gtins,
    description: description.length > 0 ? description.join("\n") : null,
    images: images.length > 0 ? images : (ld.image ?? []),
    offer: {
      price: current?.price ?? product?.price?.price ?? null,
      discountText: current?.discount?.discountText ?? null,
      startDate: current?.startDate ?? null,
      endDate: current?.endDate ?? null,
      badge: product?.stockAvailability?.badgeInfo?.badges?.[0]?.text ?? null,
    },
  };
}
