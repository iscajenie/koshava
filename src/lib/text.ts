const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "dj", е: "e", ж: "z", з: "z", и: "i", ј: "j",
  к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t",
  ћ: "c", у: "u", ф: "f", х: "h", ц: "c", ч: "c", џ: "dz", ш: "s",
  // Russian letters, so a query typed on a Russian keyboard still matches Latin names.
  ё: "e", й: "j", щ: "s", ъ: "", ы: "i", ь: "", э: "e", ю: "ju", я: "ja",
};

/** Lowercase, transliterate Cyrillic, drop diacritics: "Čokoladni MLEKO" -> "cokoladni mleko". */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[Ѐ-ӿ]/g, (ch) => CYR_TO_LAT[ch] ?? ch)
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%.,]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function slugify(input: string): string {
  return normalizeText(input)
    .replace(/[%.,]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

// Russian shoppers often search in Russian; map common grocery words to the Serbian terms used by Lidl.
const RU_SYNONYMS: Record<string, string[]> = {
  молоко: ["mleko"], кефир: ["kefir"], йогурт: ["jogurt"], сметана: ["pavlaka"], творог: ["sitni sir", "cottage"],
  сыр: ["sir"], масло: ["maslac", "ulje"], сливки: ["pavlaka", "slag"], яйца: ["jaja"], яйцо: ["jaja"],
  хлеб: ["hleb"], батон: ["hleb"], булка: ["pecivo"], выпечка: ["pecivo"], круассан: ["kroasan"],
  мясо: ["meso"], курица: ["pilec", "piletina", "pile"], куриное: ["pilec"], говядина: ["junet", "govedj"],
  свинина: ["svinj"], фарш: ["mleveno"], колбаса: ["kobasica", "salama"], сосиски: ["hrenovk"],
  ветчина: ["sunka"], бекон: ["slanina"], рыба: ["riba"], лосось: ["losos"], тунец: ["tuna", "tunj"],
  креветки: ["skamp", "kozic"], овощи: ["povrce"], фрукты: ["voce"], яблоки: ["jabuk"], яблоко: ["jabuk"],
  бананы: ["banan"], апельсины: ["pomorandz"], лимон: ["limun"], виноград: ["grozdj"], груша: ["krusk"],
  клубника: ["jagod"], помидоры: ["paradajz"], томаты: ["paradajz"], огурцы: ["krastav"], картофель: ["krompir"],
  картошка: ["krompir"], лук: ["luk"], чеснок: ["beli luk"], морковь: ["sargarep"], капуста: ["kupus"],
  перец: ["paprik", "biber"], грибы: ["pecurk"], зелень: ["persun"], салат: ["salat"], рис: ["pirinac"],
  гречка: ["heljd"], макароны: ["testenin", "spaget"], мука: ["brasno"], сахар: ["secer"], соль: ["so "],
  крупа: ["pahuljic"], овсянка: ["ovsene"], хлопья: ["pahuljic"], мёд: ["med"], мед: ["med"],
  варенье: ["dzem", "marmelad"], шоколад: ["cokolad"], конфеты: ["bombon"], печенье: ["keks"],
  чипсы: ["cips"], орехи: ["orah", "orasast"], мороженое: ["sladoled"], пицца: ["pica"], пельмени: ["knedl"],
  кофе: ["kafa"], чай: ["caj"], вода: ["voda"], сок: ["sok"], газировка: ["gazirani"], пиво: ["pivo"],
  вино: ["vino"], водка: ["votka"], детское: ["bebi", "deci"], подгузники: ["pelen"], салфетки: ["maramic"],
  туалетная: ["toalet"], бумага: ["papir"], шампунь: ["sampon"], мыло: ["sapun"], гель: ["gel"],
  порошок: ["deterdzent", "prasak"], стиральный: ["deterdzent"], посуды: ["sudov"], средство: ["sredstvo"],
  корм: ["hrana za"], кошек: ["mack"], собак: ["pas", "pse"], зубная: ["zub"], паста: ["pasta"],
};

/** Expands a query into normalized search terms, adding Serbian equivalents for Russian words. */
export function searchTerms(query: string): string[][] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((word) => {
      const variants = new Set<string>();
      const normalized = normalizeText(word);
      if (normalized.length > 0) variants.add(normalized);
      for (const [ru, sr] of Object.entries(RU_SYNONYMS)) {
        if (word.startsWith(ru.slice(0, Math.max(4, ru.length - 2)))) sr.forEach((s) => variants.add(s));
      }
      return [...variants];
    })
    .filter((v) => v.length > 0);
}
