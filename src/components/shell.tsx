"use client";

import Link from "next/link";
import { createContext, use, useState, type ReactNode } from "react";
import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import type { CategoryData } from "@/lib/catalog";
import { useShop } from "./shop-provider";
import { Logo } from "./logo";
import { CloseIcon, GridIcon, HeartIcon, HomeIcon, MenuIcon, TagIcon } from "./icons";

const MenuContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

// Pages that use the whole width on desktop; the menu drawer still works there on phones.
const FULL_WIDTH = new Set(["checkout", "admin"]);

/**
 * The page frame after Everli's store: header, the sidebar with sections and categories fixed on the left
 * (a drawer on phones), then the page and the footer.
 */
export type ShellUser = { name: string | null; isAdmin: boolean } | null;

export function Shell({
  header,
  footer,
  categories,
  user,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  categories: CategoryData[];
  user: ShellUser;
  children: ReactNode;
}) {
  const segment = useSelectedLayoutSegment();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The drawer closes once a link in it has been followed.
  const [path, setPath] = useState(pathname);
  if (path !== pathname) {
    setPath(pathname);
    setOpen(false);
  }
  const sidebar = !FULL_WIDTH.has(segment ?? "");

  return (
    <MenuContext value={{ open, setOpen }}>
      {header}
      <Sidebar categories={categories} user={user} desktop={sidebar} />
      <div className={sidebar ? "lg:pl-[300px]" : ""}>
        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        {footer}
      </div>
    </MenuContext>
  );
}

export function MenuButton() {
  const menu = use(MenuContext);
  const { t } = useShop();
  return (
    <button type="button" onClick={() => menu?.setOpen(true)} className="icon-btn -ml-2 bg-transparent lg:hidden" aria-label={t.nav.menu}>
      <MenuIcon size={22} />
    </button>
  );
}

function Sidebar({ categories, user, desktop }: { categories: CategoryData[]; user: ShellUser; desktop: boolean }) {
  const { locale, t, favorites } = useShop();
  const menu = use(MenuContext)!;
  const pathname = usePathname();
  const sale = categories.find((c) => c.isSale);
  const items = [
    { href: `/${locale}`, label: t.nav.home, icon: HomeIcon, active: pathname === `/${locale}` },
    { href: `/${locale}/catalog`, label: t.nav.catalog, icon: GridIcon, active: pathname === `/${locale}/catalog` },
    ...(sale
      ? [{ href: `/${locale}/catalog/${sale.slug}`, label: t.nav.sale, icon: TagIcon, active: pathname === `/${locale}/catalog/${sale.slug}` }]
      : []),
    { href: `/${locale}/favorites`, label: t.nav.favorites, icon: HeartIcon, active: pathname === `/${locale}/favorites`, count: favorites.size },
  ];
  const link = "flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors";
  const state = (active: boolean) => (active ? "bg-brand-light text-brand" : "text-ink hover:bg-surface");

  return (
    <>
      {menu.open && <div className="fixed inset-0 z-40 bg-ink/50 lg:hidden" onClick={() => menu.setOpen(false)} aria-hidden />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[min(340px,88vw)] overflow-y-auto overscroll-contain bg-white transition-[translate,visibility] duration-300 ease-in-out lg:top-[69px] lg:z-30 lg:w-[300px] lg:border-r lg:border-line lg:transition-none ${
          menu.open ? "visible translate-x-0" : "invisible -translate-x-full"
        } ${desktop ? "lg:visible lg:translate-x-0" : "lg:hidden"}`}
      >
        {/* Phones: the header has no room for the account, so it sits at the top of the menu, as on Everli. */}
        <div className="flex h-[68px] items-center justify-between px-4 lg:hidden">
          <Logo />
          <button type="button" onClick={() => menu.setOpen(false)} className="icon-btn" aria-label={t.nav.close}>
            <CloseIcon size={20} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 px-4 pb-3 lg:hidden">
          <Link href={user ? `/${locale}/account` : `/${locale}/login`} className="btn-dark max-w-full flex-1">
            <span className="truncate">{user ? user.name || t.nav.account : t.nav.login}</span>
          </Link>
          {user?.isAdmin && (
            <Link href={`/${locale}/admin`} className="btn-secondary h-10 px-4">
              {t.nav.admin}
            </Link>
          )}
        </div>
        <nav aria-label={t.nav.catalog} className="px-3 pt-2 pb-24 lg:pt-6 lg:pr-3 lg:pl-5">
          <ul className="space-y-0.5">
            {items.map(({ href, label, icon: Icon, active, count }) => (
              <li key={href}>
                <Link href={href} className={`${link} ${state(active)}`} aria-current={active ? "page" : undefined}>
                  <Icon size={18} />
                  {label}
                  {!!count && <span className="ml-auto text-xs text-muted tabular-nums">{count}</span>}
                </Link>
              </li>
            ))}
          </ul>
          <hr className="my-3 border-line" />
          <ul className="space-y-0.5">
            {categories
              .filter((c) => !c.isSale)
              .map((c) => {
                const active = pathname === `/${locale}/catalog/${c.slug}`;
                return (
                  <li key={c.slug}>
                    <Link href={`/${locale}/catalog/${c.slug}`} className={`${link} ${state(active)}`} aria-current={active ? "page" : undefined}>
                      {c.name}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
