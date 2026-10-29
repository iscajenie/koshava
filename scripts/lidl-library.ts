/**
 * Keeps a permanent library of lidl.rs products and their photos.
 *  - Sources: the lidl.rs sitemap (rebuilt by Lidl once a night, around 23:05 UTC) and the site search, which also
 *    shows products Lidl's editors publish during the day. Both list only current offers, not the whole assortment.
 *  - New pages, and known ones not refreshed for a week, are fetched; their photos are stored in the database.
 *  - Products that leave lidl.rs stay in the library (marked removed), photos included.
 *  - Price-list products then get the library photo whose GTIN matches one of their barcodes.
 * Runs without news are not recorded, so it can run every hour (see .github/workflows/lidl-library.yml).
 *
 *   npm run import:lidl
 */
import { and, eq, gt, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  applyLidlLibrary,
  fetchLidlRecord,
  listSearchProducts,
  listSitemapProducts,
  saveLidlRecord,
  storeLidlImage,
} from "@/lib/import/lidl-library";
import { libraryStats } from "@/lib/library";
import type { LidlProduct } from "@/lib/import/lidl-page";
import { refreshPublished } from "@/lib/import/publish";
import { sleep } from "@/lib/import/fetch";

const REFRESH_DAYS = 7;
// Photos stored per product: the card preview by default. The free database tier (500 MB) holds
// roughly 25 000 previews; raise this to keep gallery photos too.
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

/** Pages that answered 404 recently; the sitemap keeps listing expired offers for a while. */
async function recentlyGone() {
  const rows = await db
    .select({ key: schema.contentCache.key })
    .from(schema.contentCache)
    .where(
      and(
        eq(schema.contentCache.source, "lidl-page"),
        eq(schema.contentCache.found, false),
        gt(schema.contentCache.checkedAt, new Date(Date.now() - REFRESH_DAYS * DAY)),
      ),
    );
  return new Set(rows.map((r) => r.key));
}

async function rememberGone(erp: string) {
  await db
    .insert(schema.contentCache)
    .values({ source: "lidl-page", key: erp, found: false, data: null, checkedAt: new Date() })
    .onConflictDoUpdate({ target: [schema.contentCache.source, schema.contentCache.key], set: { found: false, checkedAt: new Date() } });
}

async function main() {
  const lib = schema.lidlLibrary;
  const startedAt = new Date();
  const now = startedAt;
  try {
    const [sitemap, search] = await Promise.allSettled([listSitemapProducts(), listSearchProducts()]);
    if (sitemap.status === "rejected") console.warn("sitemap:", String(sitemap.reason));
    if (search.status === "rejected") console.warn("search:", String(search.reason));
    const fromSitemap = sitemap.status === "fulfilled" ? sitemap.value.pages : [];
    const fromSearch = search.status === "fulfilled" ? search.value : [];
    const pages = new Map([...fromSitemap, ...fromSearch].map((p) => [p.erp, p.url]));
    if (pages.size < 50) throw new Error(`Only ${pages.size} products listed on lidl.rs; not marking the rest as removed`);
    const searchable = new Set(fromSearch.map((p) => p.erp));
    const known = new Map((await db.select({ erp: lib.erp, fetchedAt: lib.fetchedAt }).from(lib)).map((r) => [r.erp, r.fetchedAt]));
    const goneBefore = await recentlyGone();

    let fetched = 0;
    let added = 0;
    let images = 0;
    const gone = new Set<string>();
    for (const [erp, url] of pages) {
      const fetchedAt = known.get(erp);
      if (fetchedAt && now.getTime() - fetchedAt.getTime() < REFRESH_DAYS * DAY) continue;
      // A page that answered 404 is not asked again for a week, unless the search shows it again.
      if (goneBefore.has(erp) && !searchable.has(erp)) {
        gone.add(erp);
        continue;
      }
      try {
        const record = await fetchLidlRecord(erp, url);
        if (record) {
          await saveLidlRecord(record, now);
          images += await storeMissingImages(record.erp, record.images);
          fetched++;
          if (!known.has(erp)) added++;
          if (fetched % 50 === 0) console.log(`lidl library: ${fetched} pages, ${images} new photos`);
        } else {
          gone.add(erp);
          await rememberGone(erp);
        }
      } catch (error) {
        console.warn(`${url}:`, String(error));
      }
      await sleep(600);
    }

    // Presence: listed pages that still open are on the site; the rest is removed (kept, not deleted).
    // Removal is decided only when both sources answered, so a failed request cannot archive half the library.
    const onSite = [...pages.keys()].filter((erp) => !gone.has(erp));
    const removed =
      sitemap.status === "fulfilled" && search.status === "fulfilled"
        ? await db
            .update(lib)
            .set({ removedAt: now })
            .where(and(isNull(lib.removedAt), notInArray(lib.erp, onSite)))
            .returning({ erp: lib.erp })
        : [];
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

    const listed = { listed: pages.size, inSitemap: fromSitemap.length, inSearch: fromSearch.length, gone: gone.size };
    if (fetched + migrated + images + removed.length === 0) {
      console.log("Lidl library: nothing new", listed);
      return;
    }
    await applyLidlLibrary();
    await refreshPublished();
    const library = await libraryStats();
    const stats = {
      ...listed,
      fetched,
      added,
      removed: removed.length,
      migrated,
      newPhotos: images,
      ...library,
      ...(sitemap.status === "fulfilled" && sitemap.value.lastModified ? { sitemapBuilt: sitemap.value.lastModified } : {}),
    };
    await db.insert(schema.importRuns).values({ kind: "lidl-library", startedAt, finishedAt: new Date(), status: "ok", stats });
    console.log("Lidl library", stats);
  } catch (error) {
    await db
      .insert(schema.importRuns)
      .values({ kind: "lidl-library", startedAt, finishedAt: new Date(), status: "failed", error: String(error) });
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
