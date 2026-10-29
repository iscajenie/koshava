/**
 * Gives photos from the Idea online shop (online.idea.rs) to price-list products that have none, or only an
 * Open Food Facts photo, when Idea sells the same barcode. Photos from Lidl and Maxi are kept.
 * The whole Idea catalog (about 9 000 products with their barcodes) is read on every run.
 *
 *   npm run import:idea
 */
import { and, eq, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { listIdeaCatalog, type IdeaProduct } from "@/lib/import/idea";
import { refreshPublished } from "@/lib/import/publish";

async function main() {
  const startedAt = new Date();
  try {
    const catalog = await listIdeaCatalog();
    if (catalog.length < 1000) throw new Error(`Only ${catalog.length} products in the Idea catalog; not matching`);
    const byCode = new Map<string, IdeaProduct>();
    for (const product of catalog) for (const code of product.barcodes) byCode.set(code, product);

    const p = schema.products;
    const products = await db
      .select({ id: p.id, barcode: p.barcode, altBarcodes: p.altBarcodes, contentSource: p.contentSource })
      .from(p)
      .where(and(eq(p.isActive, true), or(isNull(p.imageUrl), eq(p.contentSource, "off"), eq(p.contentSource, "idea"))));

    let added = 0;
    let replaced = 0;
    for (const product of products) {
      const codes = [product.barcode, ...product.altBarcodes].filter((c): c is string => !!c).map((c) => c.replace(/^0+/, ""));
      const found = codes.map((c) => byCode.get(c)).find(Boolean);
      if (!found) continue;
      await db
        .update(p)
        .set({ imageUrl: found.image, images: [found.imageLarge], contentSource: "idea", enrichedAt: new Date() })
        .where(eq(p.id, product.id));
      if (product.contentSource === "off") replaced++;
      else if (product.contentSource !== "idea") added++;
    }

    await refreshPublished();
    const stats = { catalog: catalog.length, candidates: products.length, added, replaced };
    await db.insert(schema.importRuns).values({ kind: "idea", startedAt, finishedAt: new Date(), status: "ok", stats });
    console.log("Idea photos", stats);
  } catch (error) {
    await db.insert(schema.importRuns).values({ kind: "idea", startedAt, finishedAt: new Date(), status: "failed", error: String(error) });
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
