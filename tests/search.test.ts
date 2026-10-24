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

  it("delivers once a day from the next day, in Belgrade time", () => {
    const lateEvening = new Date("2026-10-24T22:30:00Z"); // 00:30 on the 25th in Belgrade
    const days = deliveryOptions(new Date("2026-10-24T07:00:00Z"));
    expect(days).toHaveLength(5);
    expect(days[0]).toMatchObject({ date: "2026-10-25", offset: 1, slots: ["10"] });
    expect(deliveryOptions(lateEvening)[0].date).toBe("2026-10-26");
    expect(isValidSlot("2026-10-24", "10", new Date("2026-10-24T07:00:00Z"))).toBe(false);
    expect(isValidSlot("2026-10-25", "10", new Date("2026-10-24T07:00:00Z"))).toBe(true);
  });
});
