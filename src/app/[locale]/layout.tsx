import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/auth/session";
import { getCartQuantities } from "@/lib/cart";
import { getFavoriteIds } from "@/lib/favorites";
import { listCategories } from "@/lib/catalog";
import { ShopProvider } from "@/components/shop-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { MobileNav } from "@/components/mobile-nav";

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

export const viewport: Viewport = { themeColor: "#0050aa", width: "device-width", initialScale: 1 };

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const [user, categories, quantities, favorites] = await Promise.all([
    getCurrentUser(),
    listCategories(locale),
    getCartQuantities(),
    getFavoriteIds(),
  ]);

  return (
    <html lang={locale === "sr" ? "sr-Latn" : "ru"}>
      <body className="flex min-h-dvh flex-col antialiased">
        <ShopProvider locale={locale} dictionary={t} initialQuantities={quantities} initialFavorites={favorites}>
          <Header locale={locale} t={t} user={user} categories={categories} />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 md:py-8">{children}</main>
          <Footer locale={locale} t={t} />
          <MobileNav signedIn={!!user} />
        </ShopProvider>
      </body>
    </html>
  );
}
