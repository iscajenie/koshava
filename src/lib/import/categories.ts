// Categories of the official price list are keyed by code. Small ones (under ~30 products) are merged
// into a related category so the navigation stays short.
export const categoryMerges: Record<string, string> = {
  "6": "14", // Mahunarke -> Testenine
  "17": "14", // Pirinač i druge žitarice -> Testenine
  "12": "13", // Šećer i med -> Brašno
  "15": "18", // Ulja i masti -> Supe, so, začini
  "16": "18", // Sirće -> Supe, so, začini
  "23": "22", // Pelene -> Hrana za bebe
};

export function siteCategoryCode(priceListCode: string) {
  return categoryMerges[priceListCode] ?? priceListCode;
}

// Site names per category code: Serbian (Latin) and Russian.
export const categoryNames: Record<string, { sr: string; ru: string }> = {
  "1": { sr: "Mleko, mlečni proizvodi i jaja", ru: "Молочные продукты и яйца" },
  "2": { sr: "Bezalkoholna pića, kafa i čaj", ru: "Напитки, кофе и чай" },
  "3": { sr: "Sveže voće i povrće", ru: "Овощи и фрукты" },
  "4": { sr: "Prerađeno voće, povrće i namazi", ru: "Консервы, соусы и намазки" },
  "5": { sr: "Hleb i peciva", ru: "Хлеб и выпечка" },
  "7": { sr: "Smrznuti proizvodi", ru: "Замороженные продукты" },
  "8": { sr: "Sveže i prerađeno meso", ru: "Мясо и колбасы" },
  "9": { sr: "Sveža i prerađena riba", ru: "Рыба и морепродукты" },
  "10": { sr: "Slani konditori", ru: "Снеки и орехи" },
  "11": { sr: "Slatki konditori i cerealije", ru: "Сладости и хлопья" },
  "13": { sr: "Sve za pečenje", ru: "Всё для выпечки" },
  "14": { sr: "Testenine i žitarice", ru: "Макароны и крупы" },
  "18": { sr: "Začini, ulja i sirće", ru: "Специи, масло и уксус" },
  "19": { sr: "Kućna hemija", ru: "Бытовая химия" },
  "20": { sr: "Papirna galanterija", ru: "Бумажные и кухонные товары" },
  "21": { sr: "Lična higijena i kozmetika", ru: "Гигиена и косметика" },
  "22": { sr: "Bebe i deca", ru: "Детские товары" },
  "24": { sr: "Alkoholna pića", ru: "Алкоголь" },
  "25": { sr: "Hrana za kućne ljubimce", ru: "Корм для животных" },
};
