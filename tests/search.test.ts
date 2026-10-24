import { describe, expect, it } from "vitest";
import { normalizeText, searchTerms, slugify } from "@/lib/text";
import { deliveryFeeFor } from "@/config/shop";
import { deliveryOptions, isValidSlot } from "@/lib/delivery";

describe("text", () => {
  it("normalizes Serbian Latin and Cyrillic the same way", () => {
    expect(normalizeText("Čokoladno MLEKO")).toBe("cokoladno mleko");
    expect(normalizeText("Чоколадно млеко")).toBe("cokoladno mleko");
    expect(slugify("Šumadijski mladi sir 500g")).toBe("sumadijski-mladi-sir-500g");
  });

  it("maps Russian grocery words to Serbian", () => {
    expect(searchTerms("молоко")[0]).toContain("mleko");
    expect(searchTerms("курица гриль")[0]).toContain("piletina");
  });
});

describe("delivery", () => {
  it("charges 10% of the goods", () => {
    expect(deliveryFeeFor(5000_00)).toBe(500_00);
    expect(deliveryFeeFor(4649_95)).toBe(465_00);
  });

  it("offers same-day slots only before the cutoff", () => {
    const morning = new Date("2026-10-24T07:00:00Z"); // 09:00 in Belgrade
    const evening = new Date("2026-10-24T15:00:00Z"); // 17:00 in Belgrade
    expect(deliveryOptions(morning)[0]).toMatchObject({ date: "2026-10-24", slots: ["13-16", "16-19", "19-22"] });
    expect(deliveryOptions(evening)[0].date).toBe("2026-10-25");
    expect(isValidSlot("2026-10-24", "10-13", morning)).toBe(false);
  });
});
