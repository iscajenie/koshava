import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/import/csv";
import { cleanName, parsePriceRow, parseSisterBarcodes } from "@/lib/import/price-list";

const header =
  "KATEGORIJA;NAZIV KATEGORIJE;Naziv proizvoda;Robna marka;Barkod proizvoda;Jedinica mere;Naziv trgovca – formata;Datum cenovnika;Redovna cena;Cena po jedinici mere;Snižena cena;Datum početka sniženja;Datum kraja sniženja;Stopa PDV;VRSTA_CENOVNIKA";

function row(line: string) {
  return parseCsv(`${header}\n${line}`)[0];
}

describe("parseCsv", () => {
  it("handles BOM, quoted headers and escaped quotes", () => {
    const rows = parseCsv('﻿"A";"B"\n"x ""y""";2\r\n');
    expect(rows).toEqual([{ A: 'x "y"', B: "2" }]);
  });
});

describe("cleanName", () => {
  it("drops shelf codes and duplicated sizes", () => {
    expect(cleanName("Avokado, 700g 700g")).toBe("Avokado, 700g");
    expect(cleanName("Ouzo 40% Vol. MK6 0,7l")).toBe("Ouzo 40% Vol. 0,7l");
    expect(cleanName("Ml. dezert na bazi sira sa jog. SK1 500g")).toBe("Ml. dezert na bazi sira sa jog. 500g");
    expect(cleanName("Kaki, rinfuz 1kg")).toBe("Kaki, rinfuz");
  });
});

describe("parsePriceRow", () => {
  it("parses a regular packaged product", () => {
    const r = parsePriceRow(
      row("18;Supe, so, začini i prilozi jelima;Krompir pire 500g;Harvest Basket;4056489789246;g;Lidl Srbija KD;24-10-2026;269.99;539.98;;;;20;VAZECI_CENOVNIK"),
      "2026-10-24",
    )!;
    expect(r).toMatchObject({
      key: "4056489789246",
      priceMinor: 26999,
      regularPriceMinor: 26999,
      unitPriceMinor: 53998,
      unitPriceLabel: "kg",
      unit: "kom",
      listDate: "2026-10-24",
      brand: "Harvest Basket",
    });
  });

  it("applies a running promotion and ignores a finished one", () => {
    const line = "3;Sveže voće i povrće;Grejpfrut, rinfuz 1kg;RM NIJE DEFINISANA;0000000000000;kom.;Lidl Srbija KD;24-10-2026;169.99;169.99;149.99;22-10-2026;25-10-2026;10;VAZECI_CENOVNIK";
    const running = parsePriceRow(row(line), "2026-10-24")!;
    expect(running).toMatchObject({ priceMinor: 14999, regularPriceMinor: 16999, saleTo: "2026-10-25", soldByWeight: true, unit: "kg", brand: null, barcode: null });
    expect(running.key).toMatch(/^n-[0-9a-f]{12}$/);
    expect(parsePriceRow(row(line), "2026-10-26")!.priceMinor).toBe(16999);
  });
});

describe("parseSisterBarcodes", () => {
  it("links barcodes both ways", () => {
    const map = parseSisterBarcodes(parseCsv("EANCODE;NAZIV_PROIZVODA;SESTRINSKI_EAN;GTIN_DESC\n2050000030406;Pire;4056489789185;Pire/KOM"));
    expect([...map.get("4056489789185")!]).toEqual(["2050000030406"]);
  });
});
