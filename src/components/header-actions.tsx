"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/money";
import { useShop } from "./shop-provider";
import { CartIcon, HeartIcon } from "./icons";

export function HeaderActions({ user }: { user: { name: string | null; isAdmin: boolean } | null }) {
  const { locale, t, cartCount, cartSubtotal, favorites, pending } = useShop();
  return (
    <>
      {user?.isAdmin && (
        <Link href={`/${locale}/admin`} className="chip hidden md:inline-flex">
          {t.nav.admin}
        </Link>
      )}
      <Link href={`/${locale}/favorites`} className="icon-btn relative hidden md:inline-flex" aria-label={t.nav.favorites}>
        <HeartIcon size={20} />
        {favorites.size > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-brand px-1 text-center text-[11px] leading-5 font-semibold text-white" data-testid="badge">
            {favorites.size > 99 ? "99+" : favorites.size}
          </span>
        )}
      </Link>
      <Link href={user ? `/${locale}/account` : `/${locale}/login`} className="btn-dark hidden max-w-48 md:inline-flex" data-testid="account-link">
        <span className="truncate">{user ? user.name || t.nav.account : t.nav.login}</span>
      </Link>
      {/* Opens the cart as a side panel over the current page (see app/[locale]/@modal/(.)cart). */}
      <Link
        href={`/${locale}/cart`}
        scroll={false}
        className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-[15px] font-medium whitespace-nowrap transition-colors ${
          cartCount > 0 ? "bg-brand text-white hover:bg-brand-dark" : "bg-surface text-ink hover:bg-surface-strong"
        }`}
        aria-label={t.nav.cart}
        aria-busy={pending || undefined}
        data-testid="cart-link"
      >
        <CartIcon size={18} />
        <span className="tabular-nums">{cartCount > 0 ? formatPrice(cartSubtotal, locale) : 0}</span>
      </Link>
    </>
  );
}
