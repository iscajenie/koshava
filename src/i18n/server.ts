import "server-only";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";

/** Locale of the current route plus its dictionary; 404 for unknown prefixes. */
export async function getI18n(): Promise<{ locale: Locale; t: ReturnType<typeof getDictionary> }> {
  const value = await rootLocale();
  if (!isLocale(value)) notFound();
  return { locale: value, t: getDictionary(value) };
}
