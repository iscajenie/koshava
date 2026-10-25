/**
 * Replaces Open Food Facts photos with Maxi's product photos where Maxi carries the same barcode.
 * Products whose barcode Maxi does not carry keep their Open Food Facts photo.
 *
 *   npm run import:maxi                       # products with an Open Food Facts photo
 *   npm run import:maxi -- --include-missing  # also products without any photo
 */
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { lookupMaxi, type MaxiProduct } from "@/lib/import/maxi";

const DAY = 24 * 60 * 60 * 1000;
const includeMissing = process.argv.includes("--include-missing");

async function main() {
  const [run] = await db.insert(schema.importRuns).values({ kind: "maxi" }).returning();
  const p = schema.products;
  const products = await db
    .select({ id: p.id, barcode: p.barcode, altBarcodes: p.altBarcodes, contentSource: p.contentSource })
    .from(p)
    .where(
      and(
        eq(p.isActive, true),
        includeMissing ? or(eq(p.contentSource, "off"), isNull(p.imageUrl)) : eq(p.contentSource, "off"),
      ),
    );

  const codes = [...new Set(products.flatMap((x) => [x.barcode, ...x.altBarcodes]).filter((c): c is string => !!c))];
  const cache = new Map<string, typeof schema.contentCache.$inferSelect>();
  for (let i = 0; i < codes.length; i += 1000) {
    const rows = await db
      .select()
      .from(schema.contentCache)
      .where(and(eq(schema.contentCache.source, "maxi"), inArray(schema.contentCache.key, codes.slice(i, i + 1000))));
    for (const r of rows) cache.set(r.key, r);
  }

  let lookups = 0;
  let replaced = 0;
  let added = 0;
  for (const product of products) {
    let found: MaxiProduct | null = null;
    for (const code of [product.barcode, ...product.altBarcodes].filter((c): c is string => !!c)) {
      const hit = cache.get(code);
      if (hit && (hit.found || Date.now() - hit.checkedAt.getTime() < 30 * DAY)) {
        if (hit.found) found = hit.data as unknown as MaxiProduct;
      } else {
        try {
          found = await lookupMaxi(code);
          lookups++;
          await db
            .insert(schema.contentCache)
            .values({ source: "maxi", key: code, found: found !== null, data: found as Record<string, unknown> | null })
            .onConflictDoUpdate({
              target: [schema.contentCache.source, schema.contentCache.key],
              set: { found: found !== null, data: found as Record<string, unknown> | null, checkedAt: new Date() },
            });
          if (lookups % 100 === 0) console.log(`maxi: ${lookups} lookups, ${replaced + added} photos`);
        } catch (error) {
          console.warn(String(error));
        }
      }
      if (found) break;
    }
    if (!found) continue;
    await db
      .update(p)
      .set({ imageUrl: found.image, images: [found.imageLarge], contentSource: "maxi", enrichedAt: new Date() })
      .where(eq(p.id, product.id));
    if (product.contentSource === "off") replaced++;
    else added++;
  }

  const stats = { candidates: products.length, lookups, replaced, added };
  await db.update(schema.importRuns).set({ status: "ok", finishedAt: new Date(), stats }).where(eq(schema.importRuns.id, run.id));
  console.log("Maxi photos", stats);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
