"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { locales } from "@/i18n/config";
import { useShop } from "./shop-provider";

export function LanguageSwitch({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const { locale, t } = useShop();
  const rest = pathname.split("/").slice(2).join("/");
  const query = search.toString();
  return (
    <div className={`flex h-10 items-center rounded-full bg-surface p-1 text-xs font-semibold ${className}`} role="group" aria-label={t.nav.language}>
      {locales.map((l) => (
        // A full page load: the page is rendered anew in the other language, and the cart or a product opens
        // as a page rather than over the previous one (client navigation would be intercepted by @modal).
        <a
          key={l}
          href={`/${l}${rest ? `/${rest}` : ""}${query ? `?${query}` : ""}`}
          aria-current={l === locale ? "true" : undefined}
          className={`flex h-8 items-center rounded-full px-2.5 uppercase transition-colors ${l === locale ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          data-testid={`lang-${l}`}
        >
          {l === "sr" ? "SR" : "RU"}
        </a>
      ))}
    </div>
  );
}
