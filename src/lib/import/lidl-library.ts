import { gunzipSync } from "node:zlib";
import sharp from "sharp";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { normalizeText } from "@/lib/text";
import {
  erpFromUrl,
  LIDL_BASE as BASE,
  LIDL_SITES,
  libraryKey,
  trustedAbroad,
  parseLidlPage,
  parseSearchPage,
  sitemapLocations,
  type LidlRecord,
  type LidlSite,
} from "./lidl-page";
import { sleep } from "./fetch";

const USER_AGENT = "Mozilla/5.0 (compatible; KoshavaBot/0.1; +https://koshava.vercel.app)";

async function get(url: string, attempt = 1): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "sr-RS,sr;q=0.9" },
      signal: AbortSignal.timeout(40_000),
    });
    if (res.status === 404 || res.status === 410) return null;
    if (res.ok) return res;
    if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} for ${url}`);
    if (attempt >= 3) throw new Error(`${res.status} for ${url}`);
  } catch (error) {
    // Network errors and timeouts are retried; other failures are final.
    if (attempt >= 3 || !(error instanceof TypeError || (error as Error).name === "TimeoutError")) throw error;
  }
  await sleep(attempt * 5000);
  return get(url, attempt + 1);
}

export type LidlPage = { erp: string; url: string };

/**
 * Product pages listed in the lidl.rs sitemap. Lidl rebuilds the sitemaps of all its countries once a night
 * (around 23:05 UTC); lastModified tells when the current one was built.
 */
export async function listSitemapProducts(): Promise<{ pages: LidlPage[]; lastModified: string | null }> {
  const index = await (await get(`${BASE}/static/sitemap.xml`))?.text();
  if (!index) throw new Error("lidl.rs sitemap index not found");
  const productMaps = sitemapLocations(index).filter((u) => u.includes("/p/export/"));
  const pages = new Map<string, string>();
  let lastModified: string | null = null;
  for (const mapUrl of productMaps) {
    const res = await get(mapUrl);
    if (!res) continue;
    const modified = res.headers.get("last-modified");
    if (modified && (!lastModified || Date.parse(modified) > Date.parse(lastModified))) lastModified = modified;
    const raw = Buffer.from(await res.arrayBuffer());
    // The product sitemap is a .gz file served as-is, not with Content-Encoding.
    const xml = (raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString("utf8");
    for (const url of sitemapLocations(xml)) {
      const erp = erpFromUrl(url);
      if (erp) pages.set(erp, url);
    }
  }
  return { pages: [...pages].map(([erp, url]) => ({ erp, url })), lastModified };
}

/** Everything a Lidl catalog search returns for a query (q=* lists the whole site; barcodes find those products). */
export async function searchCatalog(site: LidlSite, query: string): Promise<LidlPage[]> {
  const base = `https://${site.host}`;
  const pages = new Map<string, string>();
  // The API returns about 50 products per call whatever fetchsize asks for, so the offset follows what came back.
  for (let offset = 0, call = 0; call < 100; call++) {
    const params = new URLSearchParams({
      q: query,
      offset: String(offset),
      fetchsize: "48",
      locale: site.locale,
      assortment: site.assortment,
      version: "2.1.0",
    });
    const res = await get(`${base}/q/api/search?${params}`);
    if (!res) break;
    const { numFound, count, products } = parseSearchPage(await res.json(), base);
    for (const p of products) pages.set(p.erp, p.url);
    offset += count;
    if (count === 0 || offset >= numFound) break;
    await sleep(500);
  }
  return [...pages].map(([erp, url]) => ({ erp, url }));
}

/** How many products a catalog lists; 0 when the site has no catalog (yet), redirects elsewhere or rejects the locale. */
export async function probeSite(site: LidlSite) {
  // fetchsize 12 like the site itself: some catalogs answer "empty" to smaller pages.
  const params = new URLSearchParams({ q: "*", offset: "0", fetchsize: "12", locale: site.locale, assortment: site.assortment, version: "2.1.0" });
  try {
    const res = await get(`https://${site.host}/q/api/search?${params}`);
    return res ? parseSearchPage(await res.json()).numFound : 0;
  } catch {
    return 0;
  }
}

/** Products the lidl.rs search returns right now, including the ones Lidl published since the last sitemap rebuild. */
export const listSearchProducts = () => searchCatalog(LIDL_SITES[0], "*");

/** A product page parsed into the fields the library keeps; null when the page is gone. */
export async function fetchLidlRecord(erp: string, url: string): Promise<LidlRecord | null> {
  const res = await get(url);
  return res ? parseLidlPage(erp, url, await res.text()) : null;
}

/** Downloads a photo and stores it as WebP, at most 600 px (15 KB on average), so it stays available after Lidl removes it. */
export async function storeLidlImage(erp: string, sourceUrl: string, position: number) {
  const res = await get(sourceUrl);
  if (!res) return false;
  const input = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(input)
    .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 76 })
    .toBuffer({ resolveWithObject: true });
  await db
    .insert(schema.lidlImages)
    .values({ erp, sourceUrl, position, contentType: "image/webp", data, width: info.width, height: info.height, bytes: data.length })
    .onConflictDoNothing();
  await sleep(150);
  return true;
}

// Photos stored per product: the card preview by default. The free database tier (500 MB) holds
// roughly 25 000 previews; raise this to keep gallery photos too.
const IMAGES_PER_PRODUCT = Number(process.env.LIDL_LIBRARY_IMAGES ?? 1);

/** Stores the first photos of a library entry that are not stored yet; returns how many were added. */
export async function storePreviews(key: string, urls: string[]) {
  if (urls.length === 0) return 0;
  const stored = new Set(
    (
      await db
        .select({ url: schema.lidlImages.sourceUrl })
        .from(schema.lidlImages)
        .where(and(eq(schema.lidlImages.erp, key), inArray(schema.lidlImages.sourceUrl, urls)))
    ).map((r) => r.url),
  );
  let added = 0;
  for (const [position, url] of urls.slice(0, IMAGES_PER_PRODUCT).entries()) {
    if (stored.has(url)) continue;
    try {
      if (await storeLidlImage(key, url, position)) added++;
    } catch (error) {
      console.warn(`image ${url}:`, String(error));
    }
  }
  return added;
}

const sameOffer = (a: LidlRecord["offer"], b: LidlRecord["offer"]) =>
  a.price === b.price && a.discountText === b.discountText && a.startDate === b.startDate && a.endDate === b.endDate;

/** Inserts or refreshes a library entry; the offer history grows only when price or dates change. */
export async function saveLidlRecord(record: LidlRecord, now: Date, country = "rs") {
  const lib = schema.lidlLibrary;
  const key = libraryKey(country, record.erp);
  const [existing] = await db.select().from(lib).where(eq(lib.erp, key)).limit(1);
  const offers = existing?.offers ?? [];
  const last = offers[offers.length - 1];
  const nextOffers = last && sameOffer(last, record.offer) ? offers : [...offers, { ...record.offer, seenAt: now.toISOString() }];
  const values = {
    url: record.url,
    title: record.title || existing?.title || record.erp,
    brand: record.brand ?? existing?.brand ?? null,
    category: record.category ?? existing?.category ?? null,
    gtins: [...new Set([...(existing?.gtins ?? []), ...record.gtins])],
    description: record.description ?? existing?.description ?? null,
    imageUrls: [...new Set([...(existing?.imageUrls ?? []), ...record.images])],
    offers: nextOffers,
    lastSeenAt: now,
    fetchedAt: now,
    removedAt: null,
  };
  if (existing) await db.update(lib).set(values).where(eq(lib.erp, key));
  else await db.insert(lib).values({ erp: key, country, firstSeenAt: now, ...values });
  return key;
}

/**
 * Gives price-list products the library photo whose GTIN matches their barcode (current or earlier ones),
 * including products Lidl has since removed from lidl.rs. Lidl's own photos win over Maxi and Open Food Facts.
 * Photos from other Lidl countries only go to products that have no photo at all, nearest country first,
 * and are shown as reference photos (contentSource "lidl-intl"): the packaging may be in another language.
 */
export async function applyLidlLibrary() {
  const lib = schema.lidlLibrary;
  // Entries still on lidl.rs and the most recently seen come last, so they win when GTINs repeat.
  const entries = await db
    .select({
      erp: lib.erp,
      country: lib.country,
      url: lib.url,
      title: lib.title,
      gtins: lib.gtins,
      description: lib.description,
      removedAt: lib.removedAt,
    })
    .from(lib)
    .orderBy(sql`${lib.removedAt} is null`, lib.lastSeenAt);
  const images = await db
    .select({ id: schema.lidlImages.id, erp: schema.lidlImages.erp })
    .from(schema.lidlImages)
    .orderBy(schema.lidlImages.erp, schema.lidlImages.position, schema.lidlImages.id);
  const imagesByErp = new Map<string, number[]>();
  for (const img of images) imagesByErp.set(img.erp, [...(imagesByErp.get(img.erp) ?? []), img.id]);

  const rank = new Map(LIDL_SITES.map((site, i) => [site.country, i]));
  const home = new Map<string, (typeof entries)[number]>();
  const abroad = new Map<string, (typeof entries)[number]>();
  for (const e of entries) {
    if (!imagesByErp.has(e.erp)) continue;
    for (const g of e.gtins) {
      const code = g.replace(/^0+/, "");
      const current = abroad.get(code);
      if (e.country === "rs") home.set(code, e);
      else if (!trustedAbroad(code, e.country)) continue;
      else if (!current || (rank.get(e.country) ?? 99) <= (rank.get(current.country) ?? 99)) abroad.set(code, e);
    }
  }

  const p = schema.products;
  const products = await db
    .select({
      id: p.id,
      barcode: p.barcode,
      altBarcodes: p.altBarcodes,
      description: p.description,
      imageUrl: p.imageUrl,
      contentSource: p.contentSource,
    })
    .from(p)
    .where(eq(p.isActive, true));
  let matched = 0;
  for (const product of products) {
    const codes = [product.barcode, ...product.altBarcodes].filter((c): c is string => !!c).map((c) => c.replace(/^0+/, ""));
    const entry = codes.map((c) => home.get(c)).find(Boolean);
    if (!entry) {
      const foreign = codes.map((c) => abroad.get(c)).find(Boolean);
      if (product.imageUrl && product.contentSource !== "lidl-intl") continue;
      if (!foreign) {
        // A photo from abroad that no longer matches (stricter rules) is taken away again.
        if (product.contentSource === "lidl-intl") {
          await db.update(p).set({ imageUrl: null, images: [], contentSource: null }).where(eq(p.id, product.id));
        }
        continue;
      }
      const ids = imagesByErp.get(foreign.erp)!;
      await db
        .update(p)
        .set({
          imageUrl: `/api/img/${ids[0]}`,
          images: ids.slice(0, 6).map((id) => `/api/img/${id}`),
          lidlUrl: null,
          contentSource: "lidl-intl",
          enrichedAt: new Date(),
        })
        .where(eq(p.id, product.id));
      matched++;
      continue;
    }
    const ids = imagesByErp.get(entry.erp)!;
    // Lidl's title often carries the brand ("HARVEST BASKET Pomfrit"), which helps search; added once.
    const title = normalizeText(entry.title);
    await db
      .update(p)
      .set({
        imageUrl: `/api/img/${ids[0]}`,
        images: ids.slice(0, 6).map((id) => `/api/img/${id}`),
        description: entry.description ?? product.description,
        lidlUrl: entry.removedAt ? null : entry.url,
        contentSource: "lidl",
        enrichedAt: new Date(),
        searchText: sql`case when position(${title} in ${p.searchText}) > 0 then ${p.searchText} else ${p.searchText} || ' ' || ${title} end`,
      })
      .where(eq(p.id, product.id));
    matched++;
  }
  return matched;
}
