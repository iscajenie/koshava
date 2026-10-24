import { USER_AGENT, sleep } from "./fetch";

const BASE = "https://www.lidl.rs";

export type LidlListing = {
  erp: string;
  url: string;
  title: string;
  brand: string | null;
  images: string[];
  description: string[];
};

export type LidlProduct = LidlListing & { gtins: string[] };

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

async function getHtml(path: string) {
  const res = await fetch(BASE + path, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "sr-RS,sr;q=0.9" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} for ${path}`);
  return res.text();
}

type GridData = {
  erpNumber?: string;
  canonicalUrl?: string;
  fullTitle?: string;
  brand?: { name?: string };
  image?: string;
  imageList?: string[];
  keyfacts?: { title?: string; description?: string };
};

function parseGrid(html: string): LidlListing[] {
  const out: LidlListing[] = [];
  for (const m of html.matchAll(/data-grid-data="([^"]+)"/g)) {
    try {
      const d = JSON.parse(decodeEntities(m[1])) as GridData;
      if (!d.erpNumber || !d.canonicalUrl) continue;
      out.push({
        erp: d.erpNumber,
        url: d.canonicalUrl,
        title: d.keyfacts?.title || d.fullTitle || "",
        brand: d.brand?.name ?? null,
        images: d.imageList?.length ? d.imageList : d.image ? [d.image] : [],
        description: htmlToLines(d.keyfacts?.description),
      });
    } catch {
      // Malformed entry; skip it.
    }
  }
  return out;
}

/** Walks a search result list page by page; lidl.rs answers 404 past the last reachable page. */
export async function crawlSearch(query: string, maxPages = 20): Promise<LidlListing[]> {
  const found: LidlListing[] = [];
  let offset = 0;
  for (let page = 0; page < maxPages; page++) {
    const html = await getHtml(`/q/search?q=${encodeURIComponent(query)}&offset=${offset}`);
    if (!html) break;
    const items = parseGrid(html);
    if (items.length === 0) break;
    found.push(...items);
    const total = Number(html.match(/numFound\W{0,3}(\d+)/)?.[1] ?? 0);
    offset += items.length;
    if (offset >= total) break;
    await sleep(400);
  }
  return found;
}

/** Product page: JSON-LD carries the GTINs, which is what links lidl.rs to the price list. */
export async function fetchProduct(listing: LidlListing): Promise<LidlProduct | null> {
  const html = await getHtml(listing.url);
  if (!html) return null;
  let gtins: string[] = [];
  let images = listing.images;
  let description = listing.description;
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1]);
      if (d["@type"] !== "Product") continue;
      const g = d.gtin13 ?? d.gtin ?? [];
      gtins = (Array.isArray(g) ? g : [g]).map(String);
      if (Array.isArray(d.image) && d.image.length > images.length) images = d.image;
      const lines = htmlToLines(d.description);
      if (lines.length > description.length) description = lines;
    } catch {
      // Not JSON we understand.
    }
  }
  return { ...listing, images, description, gtins };
}
