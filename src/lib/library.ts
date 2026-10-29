import { and, desc, eq, isNotNull, isNull, like, sql } from "drizzle-orm";
import { db, schema } from "@/db";

export const libraryFilters = ["all", "onSite", "archived"] as const;
export type LibraryFilter = (typeof libraryFilters)[number];

const PAGE_SIZE = 96;

/** Size of the Lidl photo library, kept by scripts/lidl-library.ts. */
export async function libraryStats() {
  const lib = schema.lidlLibrary;
  const [row] = await db
    .select({
      products: sql<number>`count(*)::int`,
      onSite: sql<number>`count(*) filter (where ${lib.removedAt} is null)::int`,
      archived: sql<number>`count(*) filter (where ${lib.removedAt} is not null)::int`,
    })
    .from(lib);
  const [img] = await db
    .select({ images: sql<number>`count(*)::int`, bytes: sql<number>`coalesce(sum(${schema.lidlImages.bytes}), 0)::bigint` })
    .from(schema.lidlImages);
  const [matched] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.products)
    .where(and(eq(schema.products.isActive, true), like(schema.products.imageUrl, "/api/img/%")));
  return { ...row, images: img.images, megabytes: Math.round(Number(img.bytes) / 1024 / 102.4) / 10, matched: matched.count };
}

/** Library entries, newest first, each with its stored preview. */
export async function listLibrary(filter: LibraryFilter, page: number) {
  const lib = schema.lidlLibrary;
  const where = filter === "onSite" ? isNull(lib.removedAt) : filter === "archived" ? isNotNull(lib.removedAt) : undefined;
  // Columns are written out with table names: Drizzle leaves them unqualified here, which would match every image.
  const preview = sql<number | null>`(select min(i.id) from ${schema.lidlImages} i where i.erp = ${lib}.erp and i.position = 0)`;
  const rows = await db
    .select({
      erp: lib.erp,
      url: lib.url,
      title: lib.title,
      brand: lib.brand,
      offers: lib.offers,
      firstSeenAt: lib.firstSeenAt,
      removedAt: lib.removedAt,
      previewId: preview,
    })
    .from(lib)
    .where(where)
    .orderBy(desc(lib.firstSeenAt), desc(lib.erp))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  return { items: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}
