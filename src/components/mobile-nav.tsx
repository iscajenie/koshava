"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShop } from "./shop-provider";
import { CartIcon, GridIcon, HeartIcon, HomeIcon, UserIcon } from "./icons";

export function MobileNav({ signedIn }: { signedIn: boolean }) {
  const { locale, t, cartCount, favorites } = useShop();
  const pathname = usePathname();
  const items = [
    { href: `/${locale}`, label: t.nav.home, icon: HomeIcon, exact: true },
    { href: `/${locale}/catalog`, label: t.nav.catalog, icon: GridIcon },
    { href: `/${locale}/favorites`, label: t.nav.favorites, icon: HeartIcon, count: favorites.size },
    { href: `/${locale}/cart`, label: t.nav.cart, icon: CartIcon, count: cartCount },
    { href: signedIn ? `/${locale}/account` : `/${locale}/login`, label: signedIn ? t.nav.account : t.nav.login, icon: UserIcon },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon, count, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-brand" : "text-muted"}`}>
                <span className="relative">
                  <Icon size={22} />
                  {!!count && (
                    <span className="absolute -top-1.5 -right-2 min-w-4 rounded-full bg-sale px-1 text-center text-[10px] leading-4 font-bold text-white">
                      {count}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
