import { describe, expect, it } from "vitest";
import { erpFromUrl, htmlToLines, parseLidlPage, parseSearchPage, sitemapLocations } from "@/lib/import/lidl-page";

// Shape of a lidl.rs product page: Nuxt payload in devalue format (values referenced by index) plus JSON-LD.
const payload = [
  ["ShallowReactive", 1],
  { data: 2 },
  ["Reactive", 3],
  { product: 4 },
  { erpNumber: 5, keyfacts: 6, category: 9, eans: 10, media: 12, regionsPrices: 19, stockAvailability: 27 },
  "11000015",
  { fullTitle: 7, description: 8 },
  "NIXE Tuna u suncokretovom ulju XXL",
  "<ul><li>2 x 185 g</li><li>Tuna &amp; ulje</li></ul>",
  "Food",
  [11],
  "4056489123456",
  { gallery: 13, imageMap: 16 },
  { images: 14 },
  [15],
  "img-1",
  { "img-1": 17 },
  { largeUrl: 18 },
  "https://www.lidl.rs/assets/img-1.jpg",
  { "1": 20 },
  { currentPrice: 21 },
  { price: 22, startDate: 23, endDate: 24, discount: 25 },
  799.99,
  "2026-10-23T09:21:39.813Z",
  "2026-11-04T22:59:59Z",
  { discountText: 26 },
  "-20%",
  { badgeInfo: 28 },
  { badges: 29 },
  [30],
  { type: 31, text: 32 },
  "IN_STORE_FROM_DATE_TODAY",
  "U prodavnici",
];
const jsonLd = { "@type": "Product", name: "NIXE Tuna", gtin13: "04056489000017", brand: { name: "Nixe" } };
const page = `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head>
<body><script type="application/json" id="__NUXT_DATA__" data-ssr="true">${JSON.stringify(payload)}</script></body></html>`;

describe("parseLidlPage", () => {
  it("reads the product from the Nuxt payload and JSON-LD", () => {
    expect(parseLidlPage("11000015", "https://www.lidl.rs/p/nixe-tuna/p11000015", page)).toEqual({
      erp: "11000015",
      url: "https://www.lidl.rs/p/nixe-tuna/p11000015",
      title: "NIXE Tuna u suncokretovom ulju XXL",
      brand: "Nixe",
      category: "Food",
      gtins: ["4056489123456", "04056489000017"],
      description: "2 x 185 g\nTuna & ulje",
      images: ["https://www.lidl.rs/assets/img-1.jpg"],
      offer: {
        price: 799.99,
        discountText: "-20%",
        startDate: "2026-10-23T09:21:39.813Z",
        endDate: "2026-11-04T22:59:59Z",
        badge: "U prodavnici",
      },
    });
  });

  it("returns null for a page without a product", () => {
    expect(parseLidlPage("1", "https://www.lidl.rs/", "<html><body>Nema proizvoda</body></html>")).toBeNull();
  });
});

describe("sitemap", () => {
  it("lists product pages with their ERP numbers", () => {
    const xml = `<urlset><url><loc>https://www.lidl.rs/p/nixe-tuna/p11000015</loc></url>
      <url><loc> https://www.lidl.rs/c/akcije/a10023&amp;x=1 </loc></url></urlset>`;
    const urls = sitemapLocations(xml);
    expect(urls).toEqual(["https://www.lidl.rs/p/nixe-tuna/p11000015", "https://www.lidl.rs/c/akcije/a10023&x=1"]);
    expect(urls.map(erpFromUrl)).toEqual(["11000015", null]);
  });
});

describe("parseSearchPage", () => {
  it("lists products with absolute page URLs and counts every returned item", () => {
    const json = {
      numFound: 473,
      items: [
        { type: "product", gridbox: { data: { erpNumber: "11150384", canonicalUrl: "/p/buket-ruza/p11150384" } } },
        { type: "content", gridbox: {} },
      ],
    };
    expect(parseSearchPage(json)).toEqual({
      numFound: 473,
      count: 2,
      products: [{ erp: "11150384", url: "https://www.lidl.rs/p/buket-ruza/p11150384" }],
    });
    expect(parseSearchPage({})).toEqual({ numFound: 0, count: 0, products: [] });
  });
});

describe("htmlToLines", () => {
  it("turns list markup into lines", () => {
    expect(htmlToLines("<p>Bez glutena<br>Čuvati na suvom</p>")).toEqual(["Bez glutena", "Čuvati na suvom"]);
  });
});
