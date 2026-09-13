import type { Ingredient, Nutrition } from "./types";

/**
 * A rough nutrition estimate built from a small table of common ingredients.
 * It is explicitly labelled as an estimate everywhere it is shown: the table is
 * short, portions vary, and anything not in the table contributes nothing. When
 * a source publishes its own numbers we keep those instead of calling this.
 */

type PerGram = {
  /** Per 1 g of the ingredient. */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number; // mg
};

const per100 = (
  kcal: number, protein: number, carbs: number, fat: number,
  fiber = 0, sugar = 0, sodium = 0,
): PerGram => ({
  kcal: kcal / 100, protein: protein / 100, carbs: carbs / 100,
  fat: fat / 100, fiber: fiber / 100, sugar: sugar / 100, sodium: sodium / 100,
});

const FOODS: [string, PerGram][] = [
  ["all-purpose flour", per100(364, 10, 76, 1, 2.7, 0.3)],
  ["flour", per100(364, 10, 76, 1, 2.7, 0.3)],
  ["granulated sugar", per100(387, 0, 100, 0, 0, 100)],
  ["brown sugar", per100(380, 0, 98, 0, 0, 97)],
  ["sugar", per100(387, 0, 100, 0, 0, 100)],
  ["butter", per100(717, 0.9, 0.1, 81, 0, 0.1, 11)],
  ["olive oil", per100(884, 0, 0, 100, 0, 0)],
  ["vegetable oil", per100(884, 0, 0, 100, 0, 0)],
  ["oil", per100(884, 0, 0, 100, 0, 0)],
  ["egg", per100(143, 13, 0.7, 9.5, 0, 0.4, 142)],
  ["whole milk", per100(61, 3.2, 4.8, 3.3, 0, 5, 43)],
  ["milk", per100(61, 3.2, 4.8, 3.3, 0, 5, 43)],
  ["heavy cream", per100(340, 2.1, 2.8, 36, 0, 2.9, 27)],
  ["greek yogurt", per100(59, 10, 3.6, 0.4, 0, 3.2, 36)],
  ["yogurt", per100(61, 3.5, 4.7, 3.3, 0, 4.7, 46)],
  ["parmesan", per100(431, 38, 4.1, 29, 0, 0.9, 1529)],
  ["cheddar", per100(403, 25, 1.3, 33, 0, 0.5, 621)],
  ["mozzarella", per100(300, 22, 2.2, 22, 0, 1, 627)],
  ["cream cheese", per100(342, 6, 4.1, 34, 0, 3.2, 321)],
  ["cheese", per100(380, 24, 2.5, 31, 0, 1, 700)],
  ["chicken breast", per100(165, 31, 0, 3.6, 0, 0, 74)],
  ["chicken thigh", per100(209, 26, 0, 11, 0, 0, 84)],
  ["chicken", per100(190, 28, 0, 8, 0, 0, 80)],
  ["ground beef", per100(254, 26, 0, 15, 0, 0, 75)],
  ["beef", per100(250, 26, 0, 15, 0, 0, 72)],
  ["pork", per100(242, 27, 0, 14, 0, 0, 62)],
  ["bacon", per100(541, 37, 1.4, 42, 0, 0, 1717)],
  ["salmon", per100(208, 20, 0, 13, 0, 0, 59)],
  ["shrimp", per100(99, 24, 0.2, 0.3, 0, 0, 111)],
  ["tofu", per100(76, 8, 1.9, 4.8, 0.3, 0.6, 7)],
  ["rice", per100(365, 7, 80, 0.7, 1.3, 0.1, 5)],
  ["pasta", per100(371, 13, 75, 1.5, 3.2, 2.7, 6)],
  ["bread", per100(265, 9, 49, 3.2, 2.7, 5, 491)],
  ["potato", per100(77, 2, 17, 0.1, 2.2, 0.8, 6)],
  ["onion", per100(40, 1.1, 9.3, 0.1, 1.7, 4.2, 4)],
  ["garlic", per100(149, 6.4, 33, 0.5, 2.1, 1, 17)],
  ["tomato", per100(18, 0.9, 3.9, 0.2, 1.2, 2.6, 5)],
  ["carrot", per100(41, 0.9, 10, 0.2, 2.8, 4.7, 69)],
  ["spinach", per100(23, 2.9, 3.6, 0.4, 2.2, 0.4, 79)],
  ["broccoli", per100(34, 2.8, 7, 0.4, 2.6, 1.7, 33)],
  ["mushroom", per100(22, 3.1, 3.3, 0.3, 1, 2, 5)],
  ["bell pepper", per100(31, 1, 6, 0.3, 2.1, 4.2, 4)],
  ["avocado", per100(160, 2, 9, 15, 7, 0.7, 7)],
  ["banana", per100(89, 1.1, 23, 0.3, 2.6, 12, 1)],
  ["apple", per100(52, 0.3, 14, 0.2, 2.4, 10, 1)],
  ["honey", per100(304, 0.3, 82, 0, 0.2, 82, 4)],
  ["maple syrup", per100(260, 0, 67, 0.1, 0, 60, 12)],
  ["soy sauce", per100(53, 8, 4.9, 0.6, 0.8, 0.4, 5493)],
  ["coconut milk", per100(230, 2.3, 5.5, 24, 2.2, 3.3, 15)],
  ["peanut butter", per100(588, 25, 20, 50, 6, 9, 17)],
  ["chocolate", per100(546, 4.9, 61, 31, 7, 48, 24)],
  ["oats", per100(389, 17, 66, 7, 11, 1, 2)],
  ["almond", per100(579, 21, 22, 50, 12, 4.4, 1)],
  ["walnut", per100(654, 15, 14, 65, 6.7, 2.6, 2)],
  ["salt", per100(0, 0, 0, 0, 0, 0, 38758)],
  ["black pepper", per100(251, 10, 64, 3.3, 25, 0.6, 20)],
];

/** Longest key first so "brown sugar" wins over "sugar". */
const SORTED = [...FOODS].sort((a, b) => b[0].length - a[0].length);

/** Approximate grams for the units we parse. Deliberately coarse. */
const UNIT_GRAMS: Record<string, number> = {
  gram: 1, kilogram: 1000, ounce: 28.35, pound: 453.6,
  milliliter: 1, liter: 1000, cup: 200, tablespoon: 15, teaspoon: 5,
  "fluid ounce": 29.6, quart: 946, pint: 473, gallon: 3785,
  clove: 3, slice: 25, stick: 113, pinch: 0.4, dash: 0.6,
  can: 400, jar: 300, package: 250, bunch: 100, sprig: 2,
  head: 500, stalk: 60, handful: 30, piece: 50,
  large: 90, medium: 65, small: 45,
};

/** Volume units need a density guess; weights and counts do not. */
const VOLUME_UNITS = new Set(["cup", "tablespoon", "teaspoon", "milliliter", "liter", "fluid ounce", "quart", "pint", "gallon"]);

/** Grams per cup for things that aren't water-dense. */
const CUP_GRAMS: [string, number][] = [
  ["flour", 120], ["sugar", 200], ["brown sugar", 220], ["oats", 90],
  ["rice", 185], ["butter", 227], ["oil", 218], ["milk", 240],
  ["yogurt", 245], ["cheese", 100], ["nut", 140], ["almond", 140],
  ["walnut", 120], ["chocolate", 170], ["breadcrumb", 108], ["cocoa", 85],
];

function gramsFor(ingredient: Ingredient): number | null {
  const { quantity, unit, item } = ingredient;
  if (quantity === null) return null;

  if (!unit) {
    // A bare count: "2 eggs", "1 onion". Use a per-item weight if we know one.
    const known = SORTED.find(([name]) => item.toLowerCase().includes(name));
    if (!known) return null;
    const perItem: Record<string, number> = {
      egg: 50, onion: 150, garlic: 3, tomato: 120, carrot: 60, potato: 170,
      banana: 118, apple: 180, avocado: 150, "bell pepper": 120, "chicken breast": 170,
    };
    const weight = perItem[known[0]];
    return weight ? quantity * weight : null;
  }

  const base = UNIT_GRAMS[unit];
  if (!base) return null;

  if (VOLUME_UNITS.has(unit)) {
    const cups = (quantity * base) / UNIT_GRAMS.cup;
    const match = CUP_GRAMS.find(([name]) => item.toLowerCase().includes(name));
    const perCup = match ? match[1] : 240; // default to water density
    return cups * perCup;
  }

  return quantity * base;
}

/**
 * Estimates nutrition per serving. Returns null when too little of the recipe
 * is recognised to be worth showing — a number built from two of nine
 * ingredients would mislead more than it helps.
 */
export function estimateNutrition(
  ingredients: Ingredient[],
  servings: number | null,
): Nutrition | null {
  if (!ingredients.length) return null;

  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
  let matched = 0;

  for (const ingredient of ingredients) {
    const food = SORTED.find(([name]) => ingredient.item.toLowerCase().includes(name));
    if (!food) continue;

    const grams = gramsFor(ingredient);
    if (grams === null || grams <= 0) continue;

    matched += 1;
    const [, profile] = food;
    totals.kcal += profile.kcal * grams;
    totals.protein += profile.protein * grams;
    totals.carbs += profile.carbs * grams;
    totals.fat += profile.fat * grams;
    totals.fiber += profile.fiber * grams;
    totals.sugar += profile.sugar * grams;
    totals.sodium += profile.sodium * grams;
  }

  // Require both a decent share of the list and a few concrete matches.
  if (matched < 3 || matched / ingredients.length < 0.5) return null;

  const divisor = servings && servings > 0 ? servings : 1;
  const round = (value: number, places = 0) => {
    const factor = 10 ** places;
    return Math.round((value / divisor) * factor) / factor;
  };

  return {
    calories: round(totals.kcal),
    protein: round(totals.protein, 1),
    carbs: round(totals.carbs, 1),
    fat: round(totals.fat, 1),
    fiber: round(totals.fiber, 1),
    sugar: round(totals.sugar, 1),
    sodium: round(totals.sodium),
    source: "estimated",
  };
}
