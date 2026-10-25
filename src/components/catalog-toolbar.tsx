"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { sortOptions, type SortOption } from "@/lib/sort-options";
import { useShop } from "./shop-provider";

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
  return (
    <div className={`mb-4 flex flex-wrap items-center gap-3 ${pending ? "opacity-60" : ""}`}>
      <span className="text-sm text-muted" data-testid="result-count">
        {countLabel}
      </span>
      {showSaleToggle && (
        <label className="ml-auto flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 accent-sale"
            checked={search.get("sale") === "1"}
            onChange={(e) => update("sale", e.target.checked ? "1" : null)}
          />
          {t.catalog.onlySale}
        </label>
      )}
      <label className={`flex items-center gap-2 text-sm ${showSaleToggle ? "" : "ml-auto"}`}>
        <span className="sr-only">{t.catalog.sort}</span>
        <select
          value={sort}
          onChange={(e) => update("sort", e.target.value === "popular" ? null : e.target.value)}
          className="rounded border border-line bg-white px-3 py-2 text-sm font-medium"
        >
          {sortOptions.map((o) => (
            <option key={o} value={o}>
              {t.catalog.sortOptions[o]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
