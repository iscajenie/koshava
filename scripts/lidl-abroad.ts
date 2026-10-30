/**
 * Looks for photos of price-list products that have none, or only an Open Food Facts one, on the online catalogs
 * of other Lidl countries.
 * Lidl sells its own brands with the same barcode across Europe, and every country puts different products
 * online (weekly offers, online shop), so a product lidl.rs does not show can turn up in Croatia or Germany.
 *  - The barcodes of these products are searched on every site in LIDL_SITES, about seven per query
 *    (the search finds any of several space-separated barcodes but accepts at most 100 characters).
 *  - A hit counts only when the product page lists one of the barcodes searched.
 *  - Found products join the library with their country; the price-list product gets the photo with the
 *    "reference photo" tag, nearest country first, in place of an Open Food Facts one (see applyLidlLibrary).
 *
 *   npm run import:lidl-abroad
 *   npm run import:lidl-abroad -- --countries=hr,si,de
 */
import { and, eq, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { applyLidlLibrary, fetchLidlRecord, probeSite, saveLidlRecord, searchCatalog, storePreviews } from "@/lib/import/lidl-library";
import { LIDL_SITES, searchBatches, trustedAbroad, type LidlSite } from "@/lib/import/lidl-page";
import { refreshPublished } from "@/lib/import/publish";
import { sleep } from "@/lib/import/fetch";

// Sites are searched a few at a time; each site gets one request at a time.
const PARALLEL_SITES = 4;
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));

type Candidate = { site: LidlSite; erp: string; url: string; codes: Set<string> };

async function main() {
  const startedAt = new Date();
  try {
    // One working entry per country: catalogs that do not answer yet (Lidl's next markets) are skipped.
    const only = args.countries?.split(",");
    const sites: LidlSite[] = [];
    const offline = new Set<string>();
    for (const site of LIDL_SITES) {
      if (site.country === "rs" || (only && !only.includes(site.country)) || sites.some((s) => s.country === site.country)) continue;
      if ((await probeSite(site)) > 0) {
        sites.push(site);
        offline.delete(site.country);
      } else {
        offline.add(site.country);
      }
    }
    console.log(`${sites.length} Lidl catalogs online; not online: ${[...offline].join(", ") || "none"}`);

    // Every barcode products without a photo, or with an Open Food Facts one, ever had (Lidl swaps barcodes
    // between variants). A photo from Lidl abroad shows the same product better than a shopper's snapshot.
    const p = schema.products;
    const missing = await db
      .select({ barcode: p.barcode, altBarcodes: p.altBarcodes, imageUrl: p.imageUrl })
      .from(p)
      .where(and(eq(p.isActive, true), or(isNull(p.imageUrl), eq(p.contentSource, "off"))));
    const withoutPhoto = missing.filter((m) => !m.imageUrl).length;
    const withOff = missing.length - withoutPhoto;
    const codes = [
      ...new Set(
        missing
          .flatMap((m) => [m.barcode, ...m.altBarcodes])
          .map((c) => (c ?? "").replace(/\D/g, "").replace(/^0+/, ""))
          .filter((c) => c.length >= 8),
      ),
    ];
    // Internal Lidl codes are only worth searching where they mean the same product (see trustedAbroad).
    const batchesFor = (site: LidlSite) => searchBatches(codes.filter((code) => trustedAbroad(code, site.country)));
    console.log(`${withoutPhoto} products without a photo, ${withOff} with an Open Food Facts one, ${codes.length} barcodes`);

    const candidates = new Map<string, Candidate>();
    const failed: string[] = [];
    let queries = 0;
    const queue = [...sites];
    const worker = async () => {
      for (let site = queue.shift(); site; site = queue.shift()) {
        let hits = 0;
        try {
          for (const batch of batchesFor(site)) {
            for (const hit of await searchCatalog(site, batch.join(" "))) {
              const key = `${site.country}:${hit.erp}`;
              const candidate = candidates.get(key) ?? { site, erp: hit.erp, url: hit.url, codes: new Set<string>() };
              batch.forEach((code) => candidate.codes.add(code));
              candidates.set(key, candidate);
              hits++;
            }
            queries++;
            await sleep(400);
          }
          console.log(`${site.host}: ${hits} hits`);
        } catch (error) {
          failed.push(site.country);
          console.warn(`${site.host}:`, String(error));
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL_SITES }, worker));

    // Nearest country first; one confirmed page per product number is enough.
    const rank = new Map(LIDL_SITES.map((s, i) => [s.country, i]));
    const ordered = [...candidates.values()].sort((a, b) => (rank.get(a.site.country) ?? 99) - (rank.get(b.site.country) ?? 99));
    const done = new Set<string>();
    const byCountry: Record<string, number> = {};
    let confirmed = 0;
    let newPhotos = 0;
    for (const candidate of ordered) {
      if (done.has(candidate.erp)) continue;
      try {
        const record = await fetchLidlRecord(candidate.erp, candidate.url);
        await sleep(400);
        if (!record) continue;
        const trusted = (code: string) => trustedAbroad(code, candidate.site.country);
        let matches = record.gtins.map((g) => g.replace(/^0+/, "")).filter((g) => candidate.codes.has(g) && trusted(g));
        if (record.gtins.length === 0) {
          // Some pages list no barcode: the search is asked again with each barcode of the query alone.
          for (const code of candidate.codes) {
            const alone = await searchCatalog(candidate.site, code);
            await sleep(400);
            if (alone.some((hit) => hit.erp === candidate.erp)) {
              matches = [code];
              record.gtins = [code];
              break;
            }
          }
        }
        // A page listing other barcodes means the search matched something else; the same number elsewhere would too.
        done.add(candidate.erp);
        if (matches.length === 0) continue;
        const key = await saveLidlRecord(record, startedAt, candidate.site.country);
        newPhotos += await storePreviews(key, record.images);
        byCountry[candidate.site.country] = (byCountry[candidate.site.country] ?? 0) + 1;
        confirmed++;
      } catch (error) {
        console.warn(`${candidate.url}:`, String(error));
      }
    }

    await applyLidlLibrary();
    await refreshPublished();
    const stillMissing = await db.$count(p, and(eq(p.isActive, true), isNull(p.imageUrl)));
    const stillOff = await db.$count(p, and(eq(p.isActive, true), eq(p.contentSource, "off")));
    const stats = {
      withoutPhoto,
      openFoodFacts: withOff,
      barcodes: codes.length,
      queries,
      candidates: candidates.size,
      confirmed,
      newPhotos,
      filled: withoutPhoto - stillMissing,
      replacedOff: withOff - stillOff,
      catalogs: sites.length,
      byCountry: Object.entries(byCountry)
        .map(([country, n]) => `${country} ${n}`)
        .join(", "),
      ...(failed.length > 0 ? { failedSites: failed.join(", ") } : {}),
    };
    await db.insert(schema.importRuns).values({ kind: "lidl-abroad", startedAt, finishedAt: new Date(), status: "ok", stats });
    console.log("Lidl abroad", stats);
  } catch (error) {
    await db
      .insert(schema.importRuns)
      .values({ kind: "lidl-abroad", startedAt, finishedAt: new Date(), status: "failed", error: String(error) });
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
