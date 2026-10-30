import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import sharp from "sharp";
import { and, eq, inArray, like, sql } from "drizzle-orm";
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

/** Stores a photo as WebP, at most 600 px (15 KB on average). */
async function saveImage(erp: string, sourceUrl: string, position: number, input: Buffer) {
  const { data, info } = await sharp(input)
    .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 76 })
    .toBuffer({ resolveWithObject: true });
  await db
    .insert(schema.lidlImages)
    .values({ erp, sourceUrl, position, contentType: "image/webp", data, width: info.width, height: info.height, bytes: data.length })
    .onConflictDoNothing();
}

/** Downloads and stores a photo, so it stays available after Lidl removes it. */
export async function storeLidlImage(erp: string, sourceUrl: string, position: number) {
  const res = await get(sourceUrl);
  if (!res) return false;
  await saveImage(erp, sourceUrl, position, Buffer.from(await res.arrayBuffer()));
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

type ReferenceEntry = { name: string; brand: string | null; category: string | null; image: string; url: string; barcode?: string };

/**
 * Products of other shops kept in the library for their photos, from files in data/ (country is the library's):
 *  - everli-lidl-it.json: Lidl Italia from its Everli store, for reviewed name matches (Everli lists no barcodes);
 *  - cenolov-lidl-rs.json: Lidl Srbija on the price comparison site cenolov.rs, matched by barcode;
 *  - cenoteka-lidl-rs.json: Lidl Srbija on cenoteka.rs, for reviewed name matches.
 * The Serbian sites turn away automated requests, so their photos come from saved page captures in data/photos.
 */
const REFERENCE_SOURCES: { file: string; country: string; photos?: string }[] = [
  { file: "data/everli-lidl-it.json", country: "it" },
  { file: "data/cenolov-lidl-rs.json", country: "cenolov", photos: "data/photos/cenolov" },
  { file: "data/cenoteka-lidl-rs.json", country: "cenoteka", photos: "data/photos/cenoteka" },
];

/** Adds new reference entries and stores their photos; returns how many entries were added. */
export async function importReferenceEntries(now: Date) {
  const lib = schema.lidlLibrary;
  let added = 0;
  for (const source of REFERENCE_SOURCES) {
    const file = path.join(process.cwd(), source.file);
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, ReferenceEntry>;
    const known = new Map(
      (await db.select({ erp: lib.erp, title: lib.title, url: lib.url }).from(lib).where(eq(lib.country, source.country))).map((r) => [r.erp, r]),
    );
    // Photos from captures: the file each entry's photo was stored from (they are kept by file, not by URL).
    const stored = new Map(
      source.photos
        ? (
            await db
              .select({ erp: schema.lidlImages.erp, sourceUrl: schema.lidlImages.sourceUrl })
              .from(schema.lidlImages)
              .where(like(schema.lidlImages.erp, `${source.country}:%`))
          ).map((r) => [r.erp, r.sourceUrl])
        : [],
    );
    for (const [key, entry] of Object.entries(data)) {
      const current = known.get(key);
      const gtins = entry.barcode ? [entry.barcode] : [];
      if (current) {
        // Names can be corrected in the file (e.g. once the product's real name is known).
        if (current.title !== entry.name || current.url !== entry.url) {
          await db.update(lib).set({ title: entry.name, url: entry.url, brand: entry.brand, category: entry.category, gtins }).where(eq(lib.erp, key));
        }
      } else {
        await db.insert(lib).values({
          erp: key,
          country: source.country,
          url: entry.url,
          title: entry.name,
          brand: entry.brand,
          category: entry.category,
          gtins,
          // Only downloadable photos are listed here: the retry of failed downloads must not ask the Serbian sites.
          imageUrls: source.photos ? [] : [entry.image],
          firstSeenAt: now,
          lastSeenAt: now,
          fetchedAt: now,
        });
        added++;
      }
      if (!source.photos) {
        if (!current) await storePreviews(key, [entry.image]);
        continue;
      }
      // A new capture can bring another photo of the entry; it replaces the stored one.
      const photo = `${source.photos}/${entry.image}`;
      if (stored.get(key) === photo) continue;
      if (stored.has(key)) await db.delete(schema.lidlImages).where(eq(schema.lidlImages.erp, key));
      await saveImage(key, photo, 0, fs.readFileSync(path.join(process.cwd(), photo)));
    }
  }
  return added;
}

/** Price-list products matched by hand-reviewed name to a library entry: source key -> library key. */
function nameMatches() {
  const file = path.join(process.cwd(), "data/lidl-name-matches.json");
  if (!fs.existsSync(file)) return new Map<string, string>();
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, { erp: string }>;
  return new Map(Object.entries(data).map(([key, m]) => [key, m.erp]));
}

/**
 * Gives price-list products the library photo whose GTIN matches their barcode (current or earlier ones),
 * including products Lidl has since removed from lidl.rs. Lidl's own photos win over every other source.
 * Maxi and Idea photos stay. Products without a photo or with an Open Food Facts one get, in this order:
 *  - a photo from another Lidl country (contentSource "lidl-intl"), nearest country first: the same barcode
 *    photographed by Lidl, though the packaging may be in another language;
 *  - a reviewed name match to a Serbian product: lidl.rs under another barcode, or cenoteka.rs ("lidl-name");
 *  - the cenolov.rs photo for the barcode ("cenolov"): Serbian packaging, but chosen by a third party;
 *  - a reviewed name match to Lidl Italia from Everli ("lidl-name"), only for products without any photo.
 * All of them are shown as reference photos.
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
  const countryOf = new Map(entries.map((e) => [e.erp, e.country]));
  const home = new Map<string, (typeof entries)[number]>();
  const abroad = new Map<string, (typeof entries)[number]>();
  const cenolov = new Map<string, (typeof entries)[number]>();
  for (const e of entries) {
    if (!imagesByErp.has(e.erp)) continue;
    for (const g of e.gtins) {
      const code = g.replace(/^0+/, "");
      const current = abroad.get(code);
      if (e.country === "rs") home.set(code, e);
      else if (e.country === "cenolov") cenolov.set(code, e);
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
      sourceKey: p.sourceKey,
      imageUrl: p.imageUrl,
      images: p.images,
      contentSource: p.contentSource,
    })
    .from(p)
    .where(eq(p.isActive, true));
  const byName = nameMatches();
  let matched = 0;
  for (const product of products) {
    const codes = [product.barcode, ...product.altBarcodes].filter((c): c is string => !!c).map((c) => c.replace(/^0+/, ""));
    const entry = codes.map((c) => home.get(c)).find(Boolean);
    if (!entry) {
      const ours = product.contentSource === "lidl-intl" || product.contentSource === "lidl-name" || product.contentSource === "cenolov";
      if (product.imageUrl && !ours && product.contentSource !== "off") continue;
      // Reviewed name matches (data/lidl-name-matches.json): the same product on lidl.rs under another barcode,
      // on cenoteka.rs, or a Lidl Italia product from Everli.
      const named = byName.get(product.sourceKey);
      const namedIds = named ? imagesByErp.get(named) : undefined;
      const foreign = codes.map((c) => abroad.get(c)).find(Boolean);
      const retail = codes.map((c) => cenolov.get(c)).find(Boolean);
      const choice: [string, number[]] | null = foreign
        ? ["lidl-intl", imagesByErp.get(foreign.erp)!]
        : namedIds && countryOf.get(named!) !== "it"
          ? ["lidl-name", namedIds]
          : retail
            ? ["cenolov", imagesByErp.get(retail.erp)!]
            : namedIds && product.contentSource !== "off"
              ? ["lidl-name", namedIds]
              : null;
      if (!choice) {
        // A photo from a match that no longer holds (stricter rules, pair removed) is taken away again.
        if (ours) await db.update(p).set({ imageUrl: null, images: [], contentSource: null }).where(eq(p.id, product.id));
        continue;
      }
      matched++;
      const [source, ids] = choice;
      const images = ids.slice(0, 6).map((id) => `/api/img/${id}`);
      if (product.contentSource === source && product.images.join() === images.join()) continue;
      await db.update(p).set({ imageUrl: images[0], images, lidlUrl: null, contentSource: source, enrichedAt: new Date() }).where(eq(p.id, product.id));
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
