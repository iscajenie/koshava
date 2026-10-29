/**
 * Keeps a permanent library of lidl.rs products and their photos.
 *  - The lidl.rs sitemap lists every product page published right now (mostly weekly offers).
 *  - New pages, and known ones not refreshed for a week, are fetched; their photos are stored in the database.
 *  - Products that leave lidl.rs stay in the library (marked removed), photos included.
 *  - Price-list products then get the library photo whose GTIN matches one of their barcodes.
 *
 *   npm run import:lidl
 */
import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { applyLidlLibrary, fetchLidlRecord, listProductPages, saveLidlRecord, storeLidlImage } from "@/lib/import/lidl-library";
import { libraryStats } from "@/lib/library";
import type { LidlProduct } from "@/lib/import/lidl-page";
import { refreshPublished } from "@/lib/import/publish";
import { sleep } from "@/lib/import/fetch";

const REFRESH_DAYS = 7;
// Photos stored per product: the card preview by default. The free database tier (500 MB) holds
// roughly 20 000 previews; raise this to keep gallery photos too.
const IMAGES_PER_PRODUCT = Number(process.env.LIDL_LIBRARY_IMAGES ?? 1);
const DAY = 24 * 60 * 60 * 1000;

async function storeMissingImages(erp: string, urls: string[]) {
  if (urls.length === 0) return 0;
  const stored = new Set(
    (
      await db
        .select({ url: schema.lidlImages.sourceUrl })
        .from(schema.lidlImages)
        .where(and(eq(schema.lidlImages.erp, erp), inArray(schema.lidlImages.sourceUrl, urls)))
    ).map((r) => r.url),
  );
  let added = 0;
  for (const [position, url] of urls.slice(0, IMAGES_PER_PRODUCT).entries()) {
    if (stored.has(url)) continue;
    try {
      if (await storeLidlImage(erp, url, position)) added++;
    } catch (error) {
      console.warn(`image ${url}:`, String(error));
    }
  }
  return added;
}

async function main() {
  const [run] = await db.insert(schema.importRuns).values({ kind: "lidl-library" }).returning();
  const lib = schema.lidlLibrary;
  try {
    const now = new Date();
    const pages = await listProductPages();
    if (pages.length < 50) throw new Error(`Only ${pages.length} products in the lidl.rs sitemap; not marking the rest as removed`);
    const known = new Map((await db.select({ erp: lib.erp, fetchedAt: lib.fetchedAt }).from(lib)).map((r) => [r.erp, r.fetchedAt]));

    let fetched = 0;
    let added = 0;
    let images = 0;
    // The sitemap keeps some products whose pages already answer 404; those count as removed.
    const gone = new Set<string>();
    for (const page of pages) {
      const fetchedAt = known.get(page.erp);
      if (fetchedAt && now.getTime() - fetchedAt.getTime() < REFRESH_DAYS * DAY) continue;
      try {
        const record = await fetchLidlRecord(page.erp, page.url);
        if (record) {
          await saveLidlRecord(record, now);
          images += await storeMissingImages(record.erp, record.images);
          fetched++;
          if (!known.has(page.erp)) added++;
          if (fetched % 50 === 0) console.log(`lidl library: ${fetched} pages, ${images} new photos`);
        } else {
          gone.add(page.erp);
        }
      } catch (error) {
        console.warn(`${page.url}:`, String(error));
      }
      await sleep(600);
    }

    // Presence: listed pages that still open are on the site; the rest is removed (kept, not deleted).
    const onSite = pages.map((p) => p.erp).filter((erp) => !gone.has(erp));
    const removed = await db
      .update(lib)
      .set({ removedAt: now })
      .where(and(isNull(lib.removedAt), notInArray(lib.erp, onSite)))
      .returning({ erp: lib.erp });
    for (let i = 0; i < onSite.length; i += 500) {
      await db.update(lib).set({ lastSeenAt: now, removedAt: null }).where(inArray(lib.erp, onSite.slice(i, i + 500)));
    }

    // One-off: products seen by the earlier lidl.rs crawler that are no longer listed join the library too.
    const legacy = await db
      .select({ key: schema.contentCache.key, data: schema.contentCache.data, checkedAt: schema.contentCache.checkedAt })
      .from(schema.contentCache)
      .where(and(eq(schema.contentCache.source, "lidl"), eq(schema.contentCache.found, true)));
    const inLibrary = new Set((await db.select({ erp: lib.erp }).from(lib)).map((r) => r.erp));
    let migrated = 0;
    for (const { key, data, checkedAt } of legacy) {
      if (inLibrary.has(key) || !data) continue;
      const old = data as unknown as LidlProduct;
      await db.insert(lib).values({
        erp: key,
        url: old.url.startsWith("http") ? old.url : `https://www.lidl.rs${old.url}`,
        title: old.title || key,
        brand: old.brand,
        gtins: old.gtins ?? [],
        description: old.description?.length ? old.description.join("\n") : null,
        imageUrls: old.images ?? [],
        firstSeenAt: checkedAt,
        lastSeenAt: onSite.includes(key) ? now : checkedAt,
        removedAt: onSite.includes(key) ? null : now,
      });
      images += await storeMissingImages(key, old.images ?? []);
      migrated++;
    }

    // Previews that failed to download (network errors) are retried while Lidl still serves the photo.
    const withoutPreview = await db
      .select({ erp: lib.erp, imageUrls: lib.imageUrls })
      .from(lib)
      .where(sql`not exists (select 1 from ${schema.lidlImages} i where i.erp = ${lib}.erp)`);
    for (const entry of withoutPreview) images += await storeMissingImages(entry.erp, entry.imageUrls);

    await applyLidlLibrary();
    await refreshPublished();
    const library = await libraryStats();
    const stats = { listed: pages.length, fetched, added, removed: removed.length, migrated, newPhotos: images, ...library };
    await db.update(schema.importRuns).set({ status: "ok", finishedAt: new Date(), stats }).where(eq(schema.importRuns.id, run.id));
    console.log("Lidl library", stats);
  } catch (error) {
    await db
      .update(schema.importRuns)
      .set({ status: "failed", finishedAt: new Date(), error: String(error) })
      .where(eq(schema.importRuns.id, run.id));
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
