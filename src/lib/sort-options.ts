export const sortOptions = ["popular", "priceAsc", "priceDesc", "name", "discount"] as const;
export type SortOption = (typeof sortOptions)[number];

export function parseSort(value: string | undefined): SortOption {
  return (sortOptions as readonly string[]).includes(value ?? "") ? (value as SortOption) : "popular";
}
