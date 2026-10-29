import { sleep } from "./fetch";

// Idea (Mercator-S) online shop. Its storefront API lists every product with its barcodes, category by category.
const BASE = "https://online.idea.rs/";
const USER_AGENT = "Mozilla/5.0 (compatible; KoshavaBot/0.1; +https://koshava.vercel.app)";

export type IdeaProduct = { id: number; name: string; barcodes: string[]; image: string; imageLarge: string };

type IdeaCategory = { id: number; has_products?: boolean; children?: IdeaCategory[] };

export type IdeaApiProduct = {
  id: number;
  name: string;
  barcodes?: string[] | null;
  has_image?: boolean;
  image_path?: string | null;
  images?: { image_n?: string; image_m?: string }[];
};

type IdeaProductsPage = { _page?: { page_count?: number }; products?: IdeaApiProduct[] };

/** A catalog entry with absolute photo URLs (340 px for cards, 750 px for the product page); null without a photo. */
export function toIdeaProduct(p: IdeaApiProduct): IdeaProduct | null {
  const first = p.images?.[0];
  const image = first?.image_n ?? p.image_path;
  if (!p.has_image || !image) return null;
  return {
    id: p.id,
    name: p.name,
    barcodes: (p.barcodes ?? []).map((b) => String(b).replace(/\D/g, "").replace(/^0+/, "")).filter((b) => b.length >= 8),
    image: new URL(image, BASE).toString(),
    imageLarge: new URL(first?.image_m ?? image, BASE).toString(),
  };
}

async function get<T>(path: string, attempt = 1): Promise<T | null> {
  try {
    const res = await fetch(BASE + path, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 404) return null;
    if (res.ok) return (await res.json()) as T;
    if (res.status !== 429 && res.status < 500) throw new Error(`idea ${res.status} for ${path}`);
  } catch (error) {
    if (attempt >= 3 || !(error instanceof TypeError || (error as Error).name === "TimeoutError")) throw error;
  }
  if (attempt >= 3) throw new Error(`idea: no answer for ${path}`);
  await sleep(attempt * 5000);
  return get<T>(path, attempt + 1);
}

/** Every product of the Idea online catalog that has a photo (about 800 requests, 10 minutes). */
export async function listIdeaCatalog(): Promise<IdeaProduct[]> {
  const tree = (await get<IdeaCategory[]>("v2/categories")) ?? [];
  const leaves: IdeaCategory[] = [];
  const walk = (c: IdeaCategory) => (c.children?.length ? c.children.forEach(walk) : c.has_products !== false && leaves.push(c));
  tree.forEach(walk);

  const products = new Map<number, IdeaProduct>();
  for (const category of leaves) {
    for (let page = 1; page <= 200; page++) {
      const data = await get<IdeaProductsPage>(`v2/categories/${category.id}/products?page=${page}`);
      for (const raw of data?.products ?? []) {
        const product = toIdeaProduct(raw);
        if (product) products.set(product.id, product);
      }
      await sleep(400);
      if (!data?.products?.length || page >= (data._page?.page_count ?? 1)) break;
    }
  }
  return [...products.values()];
}
