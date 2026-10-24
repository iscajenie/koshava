"use client";

import Link from "next/link";
import { useShop } from "./shop-provider";
import { CartIcon, HeartIcon, UserIcon } from "./icons";

function Badge({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-accent px-1 text-center text-[11px] leading-5 font-bold text-ink" data-testid="badge">
      {value > 99 ? "99+" : value}
    </span>
  );
}

export function HeaderActions({ user }: { user: { name: string | null; isAdmin: boolean } | null }) {
  const { locale, t, cartCount, favorites } = useShop();
  const item = "relative hidden h-10 items-center gap-2 rounded px-2 hover:bg-white/10 md:flex";
  return (
    <>
      {user?.isAdmin && (
        <Link href={`/${locale}/admin`} className="hidden rounded bg-white/15 px-2 py-1 text-xs font-semibold md:block">
          {t.nav.admin}
        </Link>
      )}
      <Link href={`/${locale}/favorites`} className={item} aria-label={t.nav.favorites}>
        <span className="relative">
          <HeartIcon />
          <Badge value={favorites.size} />
        </span>
      </Link>
      <Link href={user ? `/${locale}/account` : `/${locale}/login`} className={item} data-testid="account-link">
        <UserIcon />
        <span className="hidden max-w-28 truncate text-sm font-medium lg:inline">{user ? user.name || t.nav.account : t.nav.login}</span>
      </Link>
      <Link href={`/${locale}/cart`} className="relative flex h-10 items-center gap-2 rounded px-2 hover:bg-white/10" aria-label={t.nav.cart} data-testid="cart-link">
        <span className="relative">
          <CartIcon />
          <Badge value={cartCount} />
        </span>
        <span className="hidden text-sm font-medium lg:inline">{t.nav.cart}</span>
      </Link>
    </>
  );
}
