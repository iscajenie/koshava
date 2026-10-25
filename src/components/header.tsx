import Link from "next/link";
import { Suspense } from "react";
import type { CurrentUser } from "@/lib/auth/session";
import type { CategoryData } from "@/lib/catalog";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { Logo } from "./logo";
import { LanguageSwitch } from "./language-switch";
import { HeaderActions } from "./header-actions";
import { SearchIcon, TagIcon } from "./icons";

export function Header({
  locale,
  t,
  user,
  categories,
}: {
  locale: Locale;
  t: Dictionary;
  user: CurrentUser | null;
  categories: CategoryData[];
}) {
  return (
    <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_var(--color-line)]">
      <div className="bg-brand text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 lg:gap-6">
          <Link href={`/${locale}`} className="shrink-0" aria-label="Koshava">
            <Logo />
          </Link>
          <form action={`/${locale}/catalog`} className="hidden flex-1 md:block" role="search">
            <SearchField t={t} />
          </form>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <Suspense>
              <LanguageSwitch className="mr-2" />
            </Suspense>
            <HeaderActions user={user ? { name: user.name, isAdmin: user.role === "admin" } : null} />
          </div>
        </div>
        <form action={`/${locale}/catalog`} className="px-4 pb-3 md:hidden" role="search">
          <SearchField t={t} />
        </form>
      </div>
      <nav className="mx-auto max-w-7xl px-4" aria-label={t.nav.catalog}>
        <ul className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto py-2 text-sm font-medium whitespace-nowrap">
          {categories.map((c) => (
            <li key={c.slug}>
              {c.isSale ? (
                <Link href={`/${locale}/catalog/${c.slug}`} className="flex items-center gap-1.5 rounded px-2.5 py-1.5 font-semibold text-sale hover:bg-surface">
                  <TagIcon size={16} />
                  {c.name}
                </Link>
              ) : (
                <Link href={`/${locale}/catalog/${c.slug}`} className="block rounded px-2.5 py-1.5 hover:bg-surface hover:text-brand">
                  {c.name}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function SearchField({ t }: { t: Dictionary }) {
  return (
    <label className="relative block">
      <span className="sr-only">{t.nav.searchPlaceholder}</span>
      <input
        type="search"
        name="q"
        placeholder={t.nav.searchPlaceholder}
        className="w-full rounded bg-white py-2.5 pr-12 pl-4 text-[15px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
        data-testid="search-input"
      />
      <button type="submit" className="absolute top-0 right-0 flex h-full w-11 items-center justify-center text-brand" aria-label={t.nav.search}>
        <SearchIcon size={20} />
      </button>
    </label>
  );
}
