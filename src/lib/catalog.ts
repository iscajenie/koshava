import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNotNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { searchTerms } from "@/lib/text";
import type { SortOption } from "@/lib/sort-options";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";

const p = schema.products;

export const productCardFields = {
  id: p.id,
  slug: p.slug,
  name: p.name,
  brand: p.brand,
  unit: p.unit,
  soldByWeight: p.soldByWeight,
  imageUrl: p.imageUrl,
  priceMinor: p.priceMinor,
  regularPriceMinor: p.regularPriceMinor,
  unitPriceMinor: p.unitPriceMinor,
  unitPriceLabel: p.unitPriceLabel,
  saleTo: p.saleTo,
  contentSource: p.contentSource,
};

export type ProductCardData = {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  unit: string | null;
  soldByWeight: boolean;
  imageUrl: string | null;
  priceMinor: number;
  regularPriceMinor: number;
  unitPriceMinor: number | null;
  unitPriceLabel: string | null;
  saleTo: string | null;
  contentSource: string | null;
};

export type CategoryData = { id: number; slug: string; name: string; count: number; image: string | null; isSale?: boolean };

// "Rasprodaja" is a virtual category: every discounted product, which also stays in its own category.
export const SALE_CATEGORY_SLUG = "rasprodaja";

const visible = eq(p.isPublished, true);
const onSale = lt(p.priceMinor, p.regularPriceMinor);

export async function listCategories(locale: Locale): Promise<CategoryData[]> {
  const rows = await db
    .select({
      id: schema.categories.id,
      slug: schema.categories.slug,
      nameSr: schema.categories.nameSr,
      nameRu: schema.categories.nameRu,
      count: sql<number>`count(${p.id})::int`,
      image: sql<string | null>`(array_agg(${p.imageUrl} order by ${p.contentSource} = 'lidl' desc, ${p.id}) filter (where ${p.imageUrl} is not null))[1]`,
    })
    .from(schema.categories)
    .innerJoin(p, and(eq(p.categoryId, schema.categories.id), visible))
    .groupBy(schema.categories.id)
    .orderBy(asc(schema.categories.sort), asc(schema.categories.nameSr));
  const [sale] = await db
    .select({
      count: sql<number>`count(*)::int`,
      image: sql<string | null>`(array_agg(${p.imageUrl} order by ${p.regularPriceMinor} - ${p.priceMinor} desc) filter (where ${p.imageUrl} is not null))[1]`,
    })
    .from(p)
    .where(and(visible, onSale));
  const saleCategory: CategoryData[] =
    sale.count > 0
      ? [{ id: 0, slug: SALE_CATEGORY_SLUG, name: getDictionary(locale).nav.sale, count: sale.count, image: sale.image, isSale: true }]
      : [];
  return [
    ...saleCategory,
    ...rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: (locale === "ru" ? r.nameRu : null) ?? r.nameSr,
      count: r.count,
      image: r.image,
    })),
  ];
}

export async function getCategory(slug: string, locale: Locale) {
  if (slug === SALE_CATEGORY_SLUG) return { id: 0, slug, name: getDictionary(locale).nav.sale, isSale: true };
  const [row] = await db.select().from(schema.categories).where(eq(schema.categories.slug, slug)).limit(1);
  if (!row) return null;
  return { id: row.id, slug: row.slug, name: (locale === "ru" ? row.nameRu : null) ?? row.nameSr, isSale: false };
}


export type ProductQuery = {
  categoryId?: number;
  q?: string;
  onlySale?: boolean;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
};

function searchCondition(q: string): SQL | undefined {
  const groups = searchTerms(q);
  if (groups.length === 0) return undefined;
  return and(...groups.map((variants) => or(...variants.map((v) => ilike(p.searchText, `%${v}%`)))));
}

function orderFor(sort: SortOption | undefined): SQL[] {
  switch (sort) {
    case "priceAsc":
      return [asc(p.priceMinor), asc(p.id)];
    case "priceDesc":
      return [desc(p.priceMinor), asc(p.id)];
    case "name":
      return [asc(p.name), asc(p.id)];
    case "discount":
      return [desc(sql`(${p.regularPriceMinor} - ${p.priceMinor})::float / greatest(${p.regularPriceMinor}, 1)`), asc(p.id)];
    default:
      // Promotions first, then products with a photo, then the price-list order within a category.
      return [desc(onSale), desc(isNotNull(p.imageUrl)), asc(p.categoryId), asc(p.id)];
  }
}

// Name comes first in search_text, so an earlier hit means a name match rather than a category match.
function relevanceOrder(q: string): SQL[] {
  const [first] = searchTerms(q);
  if (!first) return [];
  return [sql`least(${sql.join(first.map((v) => sql`nullif(strpos(${p.searchText}, ${v}), 0)`), sql`, `)}) asc nulls last`];
}

export async function listProducts(query: ProductQuery) {
  const pageSize = query.pageSize ?? 24;
  const page = Math.max(1, query.page ?? 1);
  const where = and(
    visible,
    query.categoryId ? eq(p.categoryId, query.categoryId) : undefined,
    query.onlySale ? onSale : undefined,
    query.q ? searchCondition(query.q) : undefined,
  );
  const [items, [{ total }]] = await Promise.all([
    db
      .select(productCardFields)
      .from(p)
      .where(where)
      .orderBy(...(query.q && (!query.sort || query.sort === "popular") ? relevanceOrder(query.q) : []), ...orderFor(query.sort))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(p).where(where),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getProductBySlug(slug: string) {
  const [row] = await db
    .select({
      ...productCardFields,
      barcode: p.barcode,
      description: p.description,
      images: p.images,
      categoryId: p.categoryId,
      saleFrom: p.saleFrom,
      priceListDate: p.priceListDate,
      lidlUrl: p.lidlUrl,
      contentSource: p.contentSource,
    })
    .from(p)
    .where(and(eq(p.slug, slug), visible))
    .limit(1);
  return row ?? null;
}

export async function getProductsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const rows = await db.select(productCardFields).from(p).where(and(visible, inArray(p.id, ids)));
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

export async function getSaleProducts(limit: number) {
  return db
    .select(productCardFields)
    .from(p)
    .where(and(visible, onSale))
    .orderBy(
      desc(isNotNull(p.imageUrl)),
      desc(sql`(${p.regularPriceMinor} - ${p.priceMinor})::float / greatest(${p.regularPriceMinor}, 1)`),
    )
    .limit(limit);
}

/** A stable-per-day shuffle so the home page does not always show the same products. */
export async function getFeaturedProducts(limit: number) {
  const day = new Date().toISOString().slice(0, 10);
  return db
    .select(productCardFields)
    .from(p)
    .where(and(visible, isNotNull(p.imageUrl)))
    .orderBy(sql`md5(${p.id}::text || ${day})`)
    .limit(limit);
}

export async function getRelatedProducts(categoryId: number | null, excludeId: number, limit: number) {
  if (!categoryId) return [];
  return db
    .select(productCardFields)
    .from(p)
    .where(and(visible, eq(p.categoryId, categoryId), sql`${p.id} <> ${excludeId}`))
    .orderBy(sql`md5(${p.id}::text)`)
    .limit(limit);
}
