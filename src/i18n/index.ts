import { ru, type Dictionary } from "./dictionaries/ru";
import { sr } from "./dictionaries/sr";
import type { Locale } from "./config";

export type { Dictionary };

const dictionaries: Record<Locale, Dictionary> = { ru, sr };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Replaces {placeholders}: fmt("Заказ {n}", { n: 5 }) -> "Заказ 5". */
export function fmt(template: string, values: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
}

type PluralForms = { one: string; few: string; many: string; other: string };

export function plural(forms: PluralForms, n: number, locale: Locale) {
  const rule = new Intl.PluralRules(locale === "sr" ? "sr-Latn" : "ru").select(n) as keyof PluralForms;
  return fmt(forms[rule] ?? forms.other, { n });
}
