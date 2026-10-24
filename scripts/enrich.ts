/**
 * Adds photos and descriptions to price-list products.
 *  1. lidl.rs: crawl listings, read GTINs from product pages, match by barcode.
 *  2. Open Food Facts (and Beauty / Products Facts): look up remaining barcodes.
 * Lookups are cached in content_cache, so daily runs only fetch new or stale entries.
 *
 *   npm run import:content                 # both sources
 *   npm run import:content -- --limit=200  # cap Open Food Facts lookups for this run
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { crawlSearch, fetchProduct, type LidlListing, type LidlProduct } from "@/lib/import/lidl-rs";
import { lookupBarcode, sourcesForCategory, type OpenFactsProduct } from "@/lib/import/open-food-facts";
import { refreshPublished } from "@/lib/import/publish";
import { sleep } from "@/lib/import/fetch";
import { normalizeText } from "@/lib/text";

const DAY = 24 * 60 * 60 * 1000;
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const offLimit = Number(args.limit ?? Infinity);
const skipLidl = "skip-lidl" in args;

async function cached(source: string, keys: string[]) {
  const map = new Map<string, typeof schema.contentCache.$inferSelect>();
  for (let i = 0; i < keys.length; i += 1000) {
    const rows = await db
      .select()
      .from(schema.contentCache)
      .where(and(eq(schema.contentCache.source, source), inArray(schema.contentCache.key, keys.slice(i, i + 1000))));
    for (const r of rows) map.set(r.key, r);
  }
  return map;
}

async function remember(source: string, key: string, data: object | null) {
  await db
    .insert(schema.contentCache)
    .values({ source, key, found: data !== null, data: data as Record<string, unknown> | null, checkedAt: new Date() })
    .onConflictDoUpdate({
      target: [schema.contentCache.source, schema.contentCache.key],
      set: { found: data !== null, data: data as Record<string, unknown> | null, checkedAt: new Date() },
    });
}

async function syncLidl(brands: string[]) {
  const listings = new Map<string, LidlListing>();
  // The general listing changes with every weekly promotion; per-brand searches are refreshed weekly.
  const queryCache = await cached("lidl-query", brands);
  for (const query of ["*", ...brands]) {
    const hit = queryCache.get(query);
    if (query !== "*" && hit && Date.now() - hit.checkedAt.getTime() < 7 * DAY) {
      for (const l of (hit.data?.items as LidlListing[] | undefined) ?? []) listings.set(l.erp, l);
      continue;
    }
    try {
      const items = await crawlSearch(query, query === "*" ? 20 : 4);
      for (const l of items) listings.set(l.erp, l);
      if (query !== "*") await remember("lidl-query", query, { items });
    } catch (error) {
      console.warn(`lidl.rs search "${query}" failed:`, String(error));
    }
    await sleep(300);
  }
  console.log(`lidl.rs: ${listings.size} products listed`);

  const cache = await cached("lidl", [...listings.keys()]);
  let fetched = 0;
  for (const listing of listings.values()) {
    const hit = cache.get(listing.erp);
    if (hit && Date.now() - hit.checkedAt.getTime() < 14 * DAY) continue;
    try {
      await remember("lidl", listing.erp, await fetchProduct(listing));
      fetched++;
    } catch (error) {
      console.warn(`lidl.rs ${listing.url}:`, String(error));
    }
    await sleep(350);
  }
  console.log(`lidl.rs: ${fetched} product pages fetched`);
}

async function lidlByBarcode() {
  const rows = await db
    .select({ data: schema.contentCache.data })
    .from(schema.contentCache)
    .where(and(eq(schema.contentCache.source, "lidl"), eq(schema.contentCache.found, true)));
  const map = new Map<string, LidlProduct>();
  for (const { data } of rows) {
    const p = data as unknown as LidlProduct;
    for (const g of p.gtins ?? []) map.set(g.replace(/^0+/, ""), p);
  }
  return map;
}

function offDescription(p: OpenFactsProduct) {
  return [p.quantity && `Količina: ${p.quantity}`, p.ingredients && `Sastav: ${p.ingredients.replace(/\s+/g, " ").trim()}`]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  const [run] = await db.insert(schema.importRuns).values({ kind: "content" }).returning();
  try {
    const products = await db
      .select({
        id: schema.products.id,
        barcode: schema.products.barcode,
        altBarcodes: schema.products.altBarcodes,
        brand: schema.products.brand,
        contentSource: schema.products.contentSource,
        categoryCode: schema.categories.code,
      })
      .from(schema.products)
      .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
      .where(eq(schema.products.isActive, true));

    if (!skipLidl) {
      const brands = [...new Set(products.map((p) => p.brand).filter((b): b is string => !!b))];
      await syncLidl(brands);
    }
    const lidl = await lidlByBarcode();

    let fromLidl = 0;
    const needOff: typeof products = [];
    for (const p of products) {
      const codes = [p.barcode, ...p.altBarcodes].filter((c): c is string => !!c);
      const match = codes.map((c) => lidl.get(c.replace(/^0+/, ""))).find(Boolean);
      if (match && match.images.length > 0) {
        await db
          .update(schema.products)
          .set({
            imageUrl: match.images[0],
            images: match.images.slice(0, 6),
            description: match.description.join("\n") || null,
            lidlUrl: `https://www.lidl.rs${match.url}`,
            contentSource: "lidl",
            enrichedAt: new Date(),
            searchText: sql`${schema.products.searchText} || ' ' || ${normalizeText(match.title)}`,
          })
          .where(eq(schema.products.id, p.id));
        fromLidl++;
      } else if (codes.length > 0 && p.contentSource !== "lidl") {
        needOff.push(p);
      }
    }
    console.log(`lidl.rs: ${fromLidl} price-list products matched by barcode`);

    // Open Food Facts family, one cached lookup per (database, barcode); a few products in flight at once.
    let lookups = 0;
    let fromOff = 0;
    const queue = [...needOff];
    const enrichFromOpenFacts = async (p: (typeof needOff)[number]) => {
      const codes = [p.barcode, ...p.altBarcodes].filter((c): c is string => !!c);
      let found: OpenFactsProduct | null = null;
      outer: for (const source of sourcesForCategory(p.categoryCode)) {
        const cache = await cached(source, codes);
        for (const code of codes) {
          const hit = cache.get(code);
          if (hit && (hit.found || Date.now() - hit.checkedAt.getTime() < 30 * DAY)) {
            if (hit.found) {
              found = hit.data as unknown as OpenFactsProduct;
              break outer;
            }
            continue;
          }
          if (lookups >= offLimit) continue;
          lookups++;
          try {
            const result = await lookupBarcode(source, code);
            await remember(source, code, result);
            if (result) {
              found = result;
              break outer;
            }
          } catch (error) {
            console.warn(String(error));
          }
          if (lookups % 100 === 0) console.log(`open facts: ${lookups} lookups, ${fromOff} photos so far, ${queue.length} products left`);
        }
      }
      if (found) {
        await db
          .update(schema.products)
          .set({
            imageUrl: found.image,
            images: [found.image],
            description: offDescription(found) || null,
            contentSource: "off",
            enrichedAt: new Date(),
          })
          .where(eq(schema.products.id, p.id));
        fromOff++;
      }
    };
    const worker = async () => {
      for (let p = queue.shift(); p; p = queue.shift()) await enrichFromOpenFacts(p);
    };
    await Promise.all(Array.from({ length: 4 }, worker));

    // Products whose only photo source vanished keep their last content; ones never enriched stay hidden.
    const [{ withoutImage }] = await db
      .select({ withoutImage: sql<number>`count(*)::int` })
      .from(schema.products)
      .where(and(eq(schema.products.isActive, true), isNull(schema.products.imageUrl)));
    const published = await refreshPublished();
    const stats = { fromLidl, fromOpenFacts: fromOff, lookups, withoutImage, published };
    await db.update(schema.importRuns).set({ status: "ok", finishedAt: new Date(), stats }).where(eq(schema.importRuns.id, run.id));
    console.log("Content updated", stats);
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
