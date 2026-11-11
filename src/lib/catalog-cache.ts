import "server-only";
import { unstable_cache } from "next/cache";
import type { Locale } from "@/i18n/config";
import { getCategoryRows, getSaleProducts, listCategories } from "./catalog";

// The catalog changes only with imports and photo syncs, a few times a day, and is the same for every visitor.
// These lists are read on every page (categories) or are the heaviest queries (home rows), so they are kept
// for five minutes instead of being asked from the database on each request.
const options = { revalidate: 300, tags: ["catalog"] };

export const cachedCategories = unstable_cache((locale: Locale) => listCategories(locale), ["categories"], options);

export const cachedSaleProducts = unstable_cache((limit: number) => getSaleProducts(limit), ["sale-products"], options);

/** Category id -> products, as pairs: a Map does not survive the cache. */
export const cachedCategoryRows = unstable_cache(async (perCategory: number) => [...(await getCategoryRows(perCategory))], ["category-rows"], options);
