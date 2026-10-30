import Link from "next/link";
import { Suspense } from "react";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { CurrentUser } from "@/lib/auth/session";
import { Logo } from "./logo";
import { SearchIcon } from "./icons";
import { HeaderActions } from "./header-actions";
import { LanguageSwitch } from "./language-switch";
import { MenuButton } from "./shell";

export function Header({ locale, t, user }: { locale: Locale; t: Dictionary; user: CurrentUser | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="flex h-[68px] items-center gap-3 px-4 lg:gap-8 lg:px-8">
        <MenuButton />
        {/* As wide as the sidebar, so the search starts where the page content does. */}
        <Link href={`/${locale}`} className="shrink-0 lg:w-[236px]" aria-label="Koshava">
          <Logo compact />
        </Link>
        <form action={`/${locale}`} className="hidden max-w-[640px] flex-1 md:block" role="search">
          <SearchField t={t} />
        </form>
        <div className="ml-auto flex items-center gap-2">
          <Suspense>
            <LanguageSwitch />
          </Suspense>
          <HeaderActions user={user ? { name: user.name, isAdmin: user.role === "admin" } : null} />
        </div>
      </div>
      <form action={`/${locale}`} className="px-4 pb-3 md:hidden" role="search">
        <SearchField t={t} />
      </form>
    </header>
  );
}

function SearchField({ t }: { t: Dictionary }) {
  return (
    <label className="relative block">
      <span className="sr-only">{t.nav.searchPlaceholder}</span>
      <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2" />
      <input
        type="search"
        name="q"
        placeholder={t.nav.searchPlaceholder}
        className="h-10 w-full rounded-full border border-line bg-surface pr-4 pl-11 text-sm font-medium text-ink outline-none transition-colors placeholder:text-muted focus:border-ink focus:bg-white"
        data-testid="search-input"
      />
    </label>
  );
}
