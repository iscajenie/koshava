"use client";

import Link from "next/link";
import { createContext, use, useState, type ReactNode } from "react";
import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import { shop } from "@/config/shop";
import { fmt } from "@/i18n";
import type { CategoryData } from "@/lib/catalog";
import { formatPrice } from "@/lib/money";
import { useShop } from "./shop-provider";
import { Logo, LogoMark } from "./logo";
import { CloseIcon, GridIcon, HeartIcon, HomeIcon, MenuIcon, TagIcon } from "./icons";

const MenuContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

// Pages that use the whole width on desktop; the menu drawer still works there on phones.
const FULL_WIDTH = new Set(["checkout", "admin"]);

/**
 * The page frame after Everli's store: header, the store sidebar fixed on the left (a drawer on phones),
 * then the page and the footer.
 */
export function Shell({
  header,
  footer,
  categories,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  categories: CategoryData[];
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
      <Sidebar categories={categories} desktop={sidebar} />
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

function Sidebar({ categories, desktop }: { categories: CategoryData[]; desktop: boolean }) {
  const { locale, t } = useShop();
  const menu = use(MenuContext)!;
  const pathname = usePathname();
  const sale = categories.find((c) => c.isSale);
  const items = [
    { href: `/${locale}`, label: t.nav.home, icon: HomeIcon, active: pathname === `/${locale}` },
    { href: `/${locale}/catalog`, label: t.nav.catalog, icon: GridIcon, active: pathname === `/${locale}/catalog` },
    ...(sale
      ? [{ href: `/${locale}/catalog/${sale.slug}`, label: t.nav.sale, icon: TagIcon, active: pathname === `/${locale}/catalog/${sale.slug}` }]
      : []),
    { href: `/${locale}/favorites`, label: t.nav.favorites, icon: HeartIcon, active: pathname === `/${locale}/favorites` },
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
        <div className="flex h-[68px] items-center justify-between px-4 lg:hidden">
          <Logo />
          <button type="button" onClick={() => menu.setOpen(false)} className="icon-btn" aria-label={t.nav.close}>
            <CloseIcon size={20} />
          </button>
        </div>
        <StoreCard />
        <nav aria-label={t.nav.catalog} className="px-3 pt-3 pb-24 lg:pr-3 lg:pl-5">
          <ul className="space-y-0.5">
            {items.map(({ href, label, icon: Icon, active }) => (
              <li key={href}>
                <Link href={href} className={`${link} ${state(active)}`} aria-current={active ? "page" : undefined}>
                  <Icon size={18} />
                  {label}
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

/** The store's card at the top of the sidebar, like a shop's page on Everli: name, delivery terms, payment. */
function StoreCard() {
  const { locale, t } = useShop();
  const rate = `${Math.round(shop.deliveryFeeRate * 100)}%`;
  return (
    <div className="border-b border-line pb-5">
      <div className="h-16 bg-store" />
      <div className="-mt-8 px-5">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-white">
          <LogoMark size={36} />
        </span>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-display text-xl font-semibold">Koshava</span>
          <span className="bg-accent px-1 py-0.5 text-sm leading-5 font-medium">{fmt(t.home.perks.delivery, { rate })}</span>
        </div>
        <p className="mt-1 text-sm">
          {fmt(t.shell.minOrder, { min: formatPrice(shop.minOrderMinor, locale) })} ·{" "}
          <Link href={`/${locale}/delivery`} className="text-store underline">
            {t.shell.info}
          </Link>
        </p>
        <p className="text-sm text-muted">{t.home.perks.payment}</p>
      </div>
    </div>
  );
}
