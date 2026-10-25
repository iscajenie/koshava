import { sleep } from "./fetch";

// Maxi (Delhaize Serbia) online shop. Its storefront GraphQL search matches exact barcodes.
const API = "https://www.maxi.rs/api/v1/";
const CDN = "https://static.maxi.rs";
const QUERY =
  "query GetProductSearch($lang:String $searchQuery:String $pageSize:Int $pageNumber:Int){" +
  "productSearch:productSearchV2(lang:$lang searchQuery:$searchQuery pageSize:$pageSize pageNumber:$pageNumber){" +
  "products{code name url images{format imageType url}} pagination{totalResults}}}";

export type MaxiProduct = { image: string; imageLarge: string; name: string; url: string };

type SearchResponse = {
  data?: {
    productSearch?: {
      products: { code: string; name: string; url: string; images: { format: string; imageType: string; url: string }[] }[];
      pagination: { totalResults: number };
    };
  };
};

let nextSlot = 0;

/** Product photo for a barcode, or null when Maxi does not carry it. About two requests per second. */
export async function lookupMaxi(barcode: string, attempt = 0): Promise<MaxiProduct | null> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + 500;
  if (slot > now) await sleep(slot - now);

  const res = await fetch(API, {
    method: "POST",
    // Apollo's CSRF protection rejects requests without an operation-name header.
    headers: {
      "Content-Type": "application/json",
      // A user agent mentioning "bot" is routed to a prerender service that drops the headers above.
      "User-Agent": "Mozilla/5.0 (Koshava pilot)",
      "x-apollo-operation-name": "GetProductSearch",
      "apollographql-client-name": "Web",
    },
    body: JSON.stringify({
      operationName: "GetProductSearch",
      variables: { lang: "sr", searchQuery: barcode, pageSize: 2, pageNumber: 0 },
      query: QUERY,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 2) throw new Error(`maxi ${res.status} for ${barcode}`);
    await sleep(10_000 * (attempt + 1));
    return lookupMaxi(barcode, attempt + 1);
  }
  // The search rejects some malformed codes (e.g. internal "000…" ones) with 400: treat as not carried.
  if (res.status === 400) return null;
  if (!res.ok) throw new Error(`maxi ${res.status} for ${barcode}`);
  const search = ((await res.json()) as SearchResponse).data?.productSearch;
  // A barcode query returns the one matching product; anything broader is a fuzzy fallback, not a match.
  if (!search || search.pagination.totalResults !== 1) return null;
  const [product] = search.products;
  const primary = product.images.filter((i) => i.imageType === "PRIMARY");
  const pick = (...formats: string[]) => formats.map((f) => primary.find((i) => i.format === f)).find(Boolean)?.url;
  const small = pick("respListGrid", "small", "zoom");
  const large = pick("zoom", "xlarge", "respListGrid");
  if (!small || !large) return null;
  return { image: CDN + small, imageLarge: CDN + large, name: product.name, url: `https://www.maxi.rs${product.url}` };
}
