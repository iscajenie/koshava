"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { sortOptions, type SortOption } from "@/lib/sort-options";
import { useShop } from "./shop-provider";
import { ChevronRight } from "./icons";

/** Filter chips ("All products" / "On sale") and the sort order as a pill, like the chips on Everli's category pages. */
export function CatalogToolbar({ countLabel, showSaleToggle = true }: { countLabel: string; showSaleToggle?: boolean }) {
  const { t } = useShop();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(search);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  const sort = (search.get("sort") as SortOption) ?? "popular";
  const sale = search.get("sale") === "1";
  return (
    <div className={`mt-4 mb-6 flex flex-wrap items-center gap-2 ${pending ? "opacity-60" : ""}`}>
      {showSaleToggle && (
        <>
          <button type="button" onClick={() => update("sale", null)} className={`chip ${sale ? "" : "chip-active"}`} aria-pressed={!sale}>
            {t.catalog.all}
          </button>
          <button type="button" onClick={() => update("sale", "1")} className={`chip ${sale ? "chip-active" : ""}`} aria-pressed={sale}>
            {t.catalog.onlySale}
          </button>
        </>
      )}
      <span className="ml-auto text-sm text-muted" data-testid="result-count">
        {countLabel}
      </span>
      <label className="relative">
        <span className="sr-only">{t.catalog.sort}</span>
        <select
          value={sort}
          onChange={(e) => update("sort", e.target.value === "popular" ? null : e.target.value)}
          className="chip cursor-pointer appearance-none pr-8 outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          {sortOptions.map((o) => (
            <option key={o} value={o}>
              {t.catalog.sortOptions[o]}
            </option>
          ))}
        </select>
        <ChevronRight size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rotate-90" />
      </label>
    </div>
  );
}
