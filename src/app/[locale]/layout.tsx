import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/auth/session";
import { getCartState } from "@/lib/cart";
import { getFavoriteIds } from "@/lib/favorites";
import { listCategories } from "@/lib/catalog";
import { ShopProvider } from "@/components/shop-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { MobileNav } from "@/components/mobile-nav";
import { Shell } from "@/components/shell";

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: { default: t.meta.title, template: "%s · Koshava" },
    description: t.meta.description,
    alternates: { languages: { ru: "/ru", sr: "/sr" } },
  };
}

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default async function LocaleLayout({ children, modal, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const [user, categories, cart, favorites] = await Promise.all([getCurrentUser(), listCategories(locale), getCartState(), getFavoriteIds()]);

  return (
    <html lang={locale === "sr" ? "sr-Latn" : "ru"}>
      <body className="min-h-dvh antialiased">
        <ShopProvider locale={locale} dictionary={t} initialQuantities={cart.quantities} initialPrices={cart.prices} initialFavorites={favorites}>
          <Shell header={<Header locale={locale} t={t} user={user} />} footer={<Footer locale={locale} t={t} />} categories={categories}>
            {children}
          </Shell>
          {modal}
          <MobileNav signedIn={!!user} />
        </ShopProvider>
      </body>
    </html>
  );
}
