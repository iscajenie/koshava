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

/**
 * One page of the lidl.rs search API (/q/api/search?q=*): every product currently on the site,
 * including ones published today that reach the sitemap only with its nightly rebuild.
 */
export function parseSearchPage(json: unknown) {
  const d = (json ?? {}) as { numFound?: number; items?: { gridbox?: { data?: { erpNumber?: string; canonicalUrl?: string } } }[] };
  const items = d.items ?? [];
  const products = items.flatMap((item) => {
    const g = item.gridbox?.data;
    return g?.erpNumber && g.canonicalUrl ? [{ erp: String(g.erpNumber), url: new URL(g.canonicalUrl, LIDL_BASE).toString() }] : [];
  });
  return { numFound: Number(d.numFound ?? 0), count: items.length, products };
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
