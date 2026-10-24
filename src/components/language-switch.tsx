"use client";

import Link from "next/link";
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
    <div className={`flex rounded border border-white/40 text-xs font-bold ${className}`} role="group" aria-label={t.nav.language}>
      {locales.map((l) => (
        <Link
          key={l}
          href={`/${l}${rest ? `/${rest}` : ""}${query ? `?${query}` : ""}`}
          aria-current={l === locale ? "true" : undefined}
          className={`px-2 py-1 uppercase ${l === locale ? "bg-white text-brand" : "text-white hover:bg-white/10"}`}
          data-testid={`lang-${l}`}
        >
          {l === "sr" ? "SR" : "RU"}
        </Link>
      ))}
    </div>
  );
}
