import { describe, expect, it } from "vitest";
import { toIdeaProduct } from "@/lib/import/idea";

describe("toIdeaProduct", () => {
  it("keeps barcodes without leading zeros and makes photo URLs absolute", () => {
    expect(
      toIdeaProduct({
        id: 60000428,
        name: "Bombone Kiki plus 100g Kraš",
        barcodes: ["3850102005871", "0042211631", "123"],
        has_image: true,
        image_path: "images/products/055/055026230_1.jpg?1733487314",
        images: [{ image_n: "images/products/055/055026230_1.jpg?1733487314", image_m: "images/products/055/055026230_1m.jpg?1733487314" }],
      }),
    ).toEqual({
      id: 60000428,
      name: "Bombone Kiki plus 100g Kraš",
      barcodes: ["3850102005871", "42211631"],
      image: "https://online.idea.rs/images/products/055/055026230_1.jpg?1733487314",
      imageLarge: "https://online.idea.rs/images/products/055/055026230_1m.jpg?1733487314",
    });
  });

  it("skips products without a photo", () => {
    expect(toIdeaProduct({ id: 1, name: "Bez slike", barcodes: ["8600000000000"], has_image: false, image_path: null })).toBeNull();
  });
});
