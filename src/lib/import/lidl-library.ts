import { gunzipSync } from "node:zlib";
import sharp from "sharp";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { normalizeText } from "@/lib/text";
import { erpFromUrl, parseLidlPage, sitemapLocations, type LidlRecord } from "./lidl-page";
import { sleep } from "./fetch";

const BASE = "https://www.lidl.rs";
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

/** Every product page lidl.rs currently publishes, from its sitemap. */
export async function listProductPages(): Promise<{ erp: string; url: string }[]> {
  const index = await (await get(`${BASE}/static/sitemap.xml`))?.text();
  if (!index) throw new Error("lidl.rs sitemap index not found");
  const productMaps = sitemapLocations(index).filter((u) => u.includes("/p/export/"));
  const pages = new Map<string, string>();
  for (const mapUrl of productMaps) {
    const res = await get(mapUrl);
    if (!res) continue;
    const raw = Buffer.from(await res.arrayBuffer());
    // The product sitemap is a .gz file served as-is, not with Content-Encoding.
    const xml = (raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString("utf8");
    for (const url of sitemapLocations(xml)) {
      const erp = erpFromUrl(url);
      if (erp) pages.set(erp, url);
    }
  }
  return [...pages].map(([erp, url]) => ({ erp, url }));
}

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

const sameOffer = (a: LidlRecord["offer"], b: LidlRecord["offer"]) =>
  a.price === b.price && a.discountText === b.discountText && a.startDate === b.startDate && a.endDate === b.endDate;

/** Inserts or refreshes a library entry; the offer history grows only when price or dates change. */
export async function saveLidlRecord(record: LidlRecord, now: Date) {
  const lib = schema.lidlLibrary;
  const [existing] = await db.select().from(lib).where(eq(lib.erp, record.erp)).limit(1);
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
  if (existing) await db.update(lib).set(values).where(eq(lib.erp, record.erp));
  else await db.insert(lib).values({ erp: record.erp, firstSeenAt: now, ...values });
}

/**
 * Gives price-list products the library photo whose GTIN matches their barcode (current or earlier ones),
 * including products Lidl has since removed from lidl.rs. Lidl's own photos win over Maxi and Open Food Facts.
 */
export async function applyLidlLibrary() {
  const lib = schema.lidlLibrary;
  // Entries still on lidl.rs and the most recently seen come last, so they win when GTINs repeat.
  const entries = await db
    .select({ erp: lib.erp, url: lib.url, title: lib.title, gtins: lib.gtins, description: lib.description, removedAt: lib.removedAt })
    .from(lib)
    .orderBy(sql`${lib.removedAt} is null`, lib.lastSeenAt);
  const images = await db
    .select({ id: schema.lidlImages.id, erp: schema.lidlImages.erp })
    .from(schema.lidlImages)
    .orderBy(schema.lidlImages.erp, schema.lidlImages.position, schema.lidlImages.id);
  const imagesByErp = new Map<string, number[]>();
  for (const img of images) imagesByErp.set(img.erp, [...(imagesByErp.get(img.erp) ?? []), img.id]);

  const byGtin = new Map<string, (typeof entries)[number]>();
  for (const e of entries) {
    if (!imagesByErp.has(e.erp)) continue;
    for (const g of e.gtins) byGtin.set(g.replace(/^0+/, ""), e);
  }

  const p = schema.products;
  const products = await db
    .select({ id: p.id, barcode: p.barcode, altBarcodes: p.altBarcodes, description: p.description })
    .from(p)
    .where(eq(p.isActive, true));
  let matched = 0;
  for (const product of products) {
    const codes = [product.barcode, ...product.altBarcodes].filter((c): c is string => !!c);
    const entry = codes.map((c) => byGtin.get(c.replace(/^0+/, ""))).find(Boolean);
    if (!entry) continue;
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
