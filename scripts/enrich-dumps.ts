/**
 * Bulk photo lookup from the Open Food Facts family's daily data dumps, for the first import or a full refresh.
 * The API allows only ~15 lookups/min in practice; the dumps cover every barcode in one pass (OFF is ~1.5 GB).
 * Results land in content_cache; `npm run import:content` then applies them without further requests.
 *
 *   npm run import:dumps                  # off + obf + opf
 *   npm run import:dumps -- --sources=obf,opf
 */
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { USER_AGENT } from "@/lib/import/fetch";
import type { OpenFactsProduct, OpenFactsSource } from "@/lib/import/open-food-facts";

const DUMPS: Record<OpenFactsSource, string> = {
  off: "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz",
  obf: "https://static.openbeautyfacts.org/data/en.openbeautyfacts.org.products.csv.gz",
  opf: "https://static.openproductsfacts.org/data/en.openproductsfacts.org.products.csv.gz",
};

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const sources = (args.sources?.split(",") ?? Object.keys(DUMPS)) as OpenFactsSource[];

async function wantedBarcodes() {
  const rows = await db.execute<{ code: string }>(sql`
    select distinct code from (
      select barcode as code from products where is_active and barcode is not null
      union select jsonb_array_elements_text(alt_barcodes) from products where is_active
    ) s`);
  // Dumps drop leading zeros inconsistently, so match on the trimmed form.
  return new Map(rows.map((r) => [r.code.replace(/^0+/, ""), r.code]));
}

async function scanDump(source: OpenFactsSource, wanted: Map<string, string>) {
  const res = await fetch(DUMPS[source], { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok || !res.body) throw new Error(`${source} dump: ${res.status}`);
  const lines = createInterface({ input: Readable.fromWeb(res.body as never).pipe(createGunzip()), crlfDelay: Infinity });
  const found = new Map<string, OpenFactsProduct>();
  let col: Record<string, number> | null = null;
  let rows = 0;
  for await (const line of lines) {
    const cells = line.split("\t");
    if (!col) {
      col = Object.fromEntries(cells.map((name, i) => [name, i]));
      continue;
    }
    rows++;
    const code = wanted.get((cells[col.code] ?? "").trim().replace(/^0+/, ""));
    const image = cells[col.image_url]?.trim();
    if (!code || !image) continue;
    found.set(code, {
      image,
      name: cells[col.product_name]?.trim() || null,
      quantity: cells[col.quantity]?.trim() || null,
      // The dump has no per-language ingredient lists; descriptions keep just the quantity.
      ingredients: null,
    });
  }
  console.log(`${source}: scanned ${rows} products, photos for ${found.size} of ${wanted.size} barcodes`);
  return found;
}

async function main() {
  const wanted = await wantedBarcodes();
  for (const source of sources) {
    const found = await scanDump(source, wanted);
    const entries = [...wanted.values()].map((key) => ({ source, key, found: found.has(key), data: found.get(key) ?? null }));
    for (let i = 0; i < entries.length; i += 1000) {
      await db
        .insert(schema.contentCache)
        .values(entries.slice(i, i + 1000).map((e) => ({ ...e, data: e.data as Record<string, unknown> | null, checkedAt: new Date() })))
        .onConflictDoUpdate({
          target: [schema.contentCache.source, schema.contentCache.key],
          // Keep richer API results (with ingredients) that are already cached.
          set: { found: sql`excluded.found`, data: sql`excluded.data`, checkedAt: sql`excluded.checked_at` },
          setWhere: eq(schema.contentCache.found, false),
        });
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
