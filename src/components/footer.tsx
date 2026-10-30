import Link from "next/link";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { Logo } from "./logo";

export function Footer({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <footer className="border-t border-line text-subtle">
      <div className="grid gap-6 px-4 py-8 text-sm md:grid-cols-[auto_1fr_auto] md:items-start lg:px-8">
        <div className="text-ink">
          <Logo />
        </div>
        <div className="space-y-2">
          <p>{t.footer.disclaimer}</p>
          <p className="text-muted">{t.footer.pilot}</p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-2 font-medium text-ink md:flex-col">
          <li>
            <Link href={`/${locale}/delivery`} className="hover:underline">
              {t.nav.delivery}
            </Link>
          </li>
          <li>
            <Link href={`/${locale}/catalog`} className="hover:underline">
              {t.nav.catalog}
            </Link>
          </li>
          <li>
            <Link href={`/${locale}/privacy`} className="hover:underline">
              {t.nav.privacy}
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
