/**
 * Adds photos and descriptions to price-list products.
 *  1. Lidl library (see scripts/lidl-library.ts): photos of every product ever seen on lidl.rs, matched by GTIN.
 *  2. Open Food Facts (and Beauty / Products Facts): look up remaining barcodes.
 * Lookups are cached in content_cache, so repeated runs only fetch new or stale entries.
 *
 *   npm run import:content                 # both sources
 *   npm run import:content -- --limit=200  # cap Open Food Facts lookups for this run
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { applyLidlLibrary } from "@/lib/import/lidl-library";
import { currentSpacingMs, lookupBarcode, sourcesForCategory, type OpenFactsProduct } from "@/lib/import/open-food-facts";
import { refreshPublished } from "@/lib/import/publish";

const DAY = 24 * 60 * 60 * 1000;
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const offLimit = Number(args.limit ?? Infinity);

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

function offDescription(p: OpenFactsProduct) {
  return [p.quantity && `Količina: ${p.quantity}`, p.ingredients && `Sastav: ${p.ingredients.replace(/\s+/g, " ").trim()}`]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  const [run] = await db.insert(schema.importRuns).values({ kind: "content" }).returning();
  try {
    const fromLidl = await applyLidlLibrary();
    console.log(`Lidl library: ${fromLidl} price-list products matched by barcode`);

    const products = await db
      .select({
        id: schema.products.id,
        barcode: schema.products.barcode,
        altBarcodes: schema.products.altBarcodes,
        contentSource: schema.products.contentSource,
        categoryCode: schema.categories.code,
      })
      .from(schema.products)
      .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
      .where(eq(schema.products.isActive, true));
    const needOff = products.filter(
      (p) => (p.barcode || p.altBarcodes.length > 0) && !["lidl", "lidl-intl", "lidl-name", "cenolov", "maxi", "idea"].includes(p.contentSource ?? ""),
    );

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
          if (lookups % 100 === 0) console.log(`open facts: ${lookups} lookups, ${fromOff} photos so far, ${queue.length} products left, ${currentSpacingMs()} ms between requests`);
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
