/**
 * Loads the official Lidl Srbija price list into the catalog.
 *
 *   npm run import:prices                # downloads LIDL_PRICES_CSV_URL
 *   npm run import:prices -- ./file.csv  # imports a local copy
 */
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { parseCsv } from "@/lib/import/csv";
import { CURRENT_LIST, parsePriceRow, parseSisterBarcodes, productSlug, type PriceRow } from "@/lib/import/price-list";
import { categoryNames, siteCategoryCode } from "@/lib/import/categories";
import { belgradeToday, loadText } from "@/lib/import/fetch";
import { normalizeText, slugify } from "@/lib/text";
import { refreshPublished } from "@/lib/import/publish";
import { rekeyLegacyProducts } from "@/lib/import/rekey";

const PRICES_URL =
  process.env.LIDL_PRICES_CSV_URL ?? "https://www.lidl.rs/explore/assets/webPriceData/rs/cene_proizvoda_Lidl.csv";
const EAN_URL = process.env.LIDL_EAN_CSV_URL ?? "https://www.lidl.rs/explore/assets/webPriceData/rs/EAN.csv";

function chunks<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  const [run] = await db.insert(schema.importRuns).values({ kind: "prices" }).returning();
  try {
    const source = process.argv[2] ?? PRICES_URL;
    const today = belgradeToday();
    const rows = parseCsv(await loadText(source))
      .map((r) => parsePriceRow(r, today))
      .filter((r): r is PriceRow => r !== null);
    // Repeated names are different products (e.g. two apple varieties): number them in a stable order.
    const byName = new Map<string, PriceRow[]>();
    for (const r of rows.filter((x) => x.kind === CURRENT_LIST)) byName.set(r.key, [...(byName.get(r.key) ?? []), r]);
    const current = new Map<string, PriceRow>();
    for (const [key, same] of byName) {
      same.sort((a, b) => a.regularPriceMinor - b.regularPriceMinor || (a.barcode ?? "").localeCompare(b.barcode ?? ""));
      same.forEach((r, i) => {
        r.key = i === 0 ? key : `${key}-${i + 1}`;
        current.set(r.key, r);
      });
    }
    if (current.size < 500) throw new Error(`Only ${current.size} current rows in ${source}; refusing to deactivate the catalog`);

    const merged = await rekeyLegacyProducts();
    if (merged > 0) console.log(`Re-keyed products by name, merged ${merged} duplicates`);

    let sisters = new Map<string, Set<string>>();
    try {
      sisters = parseSisterBarcodes(parseCsv(await loadText(EAN_URL)));
    } catch (error) {
      console.warn("EAN.csv unavailable, continuing without sister barcodes:", error);
    }

    // Categories: small price-list categories are merged into related ones (see categoryMerges).
    for (const r of current.values()) r.categoryCode = siteCategoryCode(r.categoryCode);
    const categoryRows = new Map<string, string>();
    for (const r of current.values()) categoryRows.set(r.categoryCode, r.categoryName);
    for (const [code, listName] of categoryRows) {
      const nameSr = categoryNames[code]?.sr ?? listName;
      const nameRu = categoryNames[code]?.ru ?? null;
      await db
        .insert(schema.categories)
        .values({ code, slug: slugify(nameSr), nameSr, nameRu, sort: Number(code) || 999 })
        .onConflictDoUpdate({ target: schema.categories.code, set: { slug: slugify(nameSr), nameSr, nameRu } });
    }
    const categoryIds = new Map(
      (await db.select({ id: schema.categories.id, code: schema.categories.code }).from(schema.categories)).map((c) => [c.code, c.id]),
    );

    // Products
    const now = new Date();
    const previous = new Map(
      (await db.select({ key: schema.products.sourceKey, barcode: schema.products.barcode, alt: schema.products.altBarcodes }).from(schema.products)).map(
        (p) => [p.key, p],
      ),
    );
    // Every barcode a product has carried, plus Lidl's sister codes, helps find its photo.
    const altBarcodesFor = (r: PriceRow) => {
      const prev = previous.get(r.key);
      const codes = new Set([...(prev?.alt ?? []), ...(prev?.barcode ? [prev.barcode] : []), ...(r.barcode ? [...(sisters.get(r.barcode) ?? [])] : [])]);
      if (r.barcode) codes.delete(r.barcode);
      return [...codes];
    };
    const values = [...current.values()].map((r) => ({
      sourceKey: r.key,
      slug: productSlug(r.name, r.key),
      barcode: r.barcode,
      altBarcodes: altBarcodesFor(r),
      name: r.name,
      sourceName: r.sourceName,
      brand: r.brand,
      categoryId: categoryIds.get(r.categoryCode) ?? null,
      unit: r.unit,
      soldByWeight: r.soldByWeight,
      vatRate: r.vatRate,
      priceMinor: r.priceMinor,
      regularPriceMinor: r.regularPriceMinor,
      unitPriceMinor: r.unitPriceMinor,
      unitPriceLabel: r.unitPriceLabel,
      saleFrom: r.saleFrom,
      saleTo: r.saleTo,
      priceListDate: r.listDate,
      isActive: true,
      searchText: normalizeText(
        [r.name, r.brand, r.categoryName, categoryNames[r.categoryCode]?.sr, categoryNames[r.categoryCode]?.ru].filter(Boolean).join(" "),
      ),
      updatedAt: now,
    }));
    const existingRows = await db.select({ key: schema.products.sourceKey, slug: schema.products.slug }).from(schema.products);
    const existing = new Set(existingRows.map((p) => p.key));
    // Two products can share a name and the last digits of their barcode; the newcomer gets the full key.
    const slugOwner = new Map(existingRows.map((p) => [p.slug, p.key]));
    for (const v of values) {
      const owner = slugOwner.get(v.slug);
      if (owner && owner !== v.sourceKey) v.slug = `${slugify(v.name)}-${v.sourceKey}`;
      slugOwner.set(v.slug, v.sourceKey);
    }
    for (const batch of chunks(values, 400)) {
      await db
        .insert(schema.products)
        .values(batch)
        .onConflictDoUpdate({
          target: schema.products.sourceKey,
          // The slug is kept from the first import so product links stay stable.
          set: Object.fromEntries(
            Object.keys(batch[0])
              .filter((k) => k !== "sourceKey" && k !== "slug")
              .map((k) => [k, sql.raw(`excluded."${toColumn(k)}"`)]),
          ),
        });
    }
    const keys = [...current.keys()];
    const deactivated = await db
      .update(schema.products)
      .set({ isActive: false, updatedAt: now })
      .where(and(eq(schema.products.isActive, true), notInArray(schema.products.sourceKey, keys)))
      .returning({ id: schema.products.id });

    // Price history: the current list plus the monthly snapshots shipped in the same file.
    const ids = new Map<string, number>();
    for (const batch of chunks(keys, 1000)) {
      const found = await db
        .select({ id: schema.products.id, key: schema.products.sourceKey })
        .from(schema.products)
        .where(inArray(schema.products.sourceKey, batch));
      for (const f of found) ids.set(f.key, f.id);
    }
    const history = new Map<string, { productId: number; day: string; priceMinor: number; regularPriceMinor: number }>();
    for (const r of rows) {
      const productId = ids.get(r.key) ?? ids.get(r.key.replace(/-\d+$/, ""));
      if (productId) history.set(`${productId}:${r.listDate}`, { productId, day: r.listDate, priceMinor: r.priceMinor, regularPriceMinor: r.regularPriceMinor });
    }
    for (const batch of chunks([...history.values()], 1000)) {
      await db
        .insert(schema.priceHistory)
        .values(batch)
        .onConflictDoUpdate({
          target: [schema.priceHistory.productId, schema.priceHistory.day],
          set: { priceMinor: sql`excluded.price_minor`, regularPriceMinor: sql`excluded.regular_price_minor` },
        });
    }

    // Categories left without products (merged away) are removed.
    await db.execute(sql`delete from categories c where not exists (select 1 from products p where p.category_id = c.id)`);

    const published = await refreshPublished();
    const stats = {
      rows: current.size,
      added: keys.filter((k) => !existing.has(k)).length,
      deactivated: deactivated.length,
      onSale: values.filter((v) => v.priceMinor < v.regularPriceMinor).length,
      published,
      listDate: values[0]?.priceListDate ?? "",
    };
    await db.update(schema.importRuns).set({ status: "ok", finishedAt: new Date(), stats }).where(eq(schema.importRuns.id, run.id));
    console.log("Price list imported", stats);
  } catch (error) {
    await db
      .update(schema.importRuns)
      .set({ status: "failed", finishedAt: new Date(), error: String(error) })
      .where(eq(schema.importRuns.id, run.id));
    throw error;
  }
}

function toColumn(key: string) {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
