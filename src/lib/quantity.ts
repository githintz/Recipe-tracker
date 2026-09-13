import type { Ingredient } from "./types";

const VULGAR: Record<string, number> = {
  "¼": 0.25, "½": 0.5, "¾": 0.75, "⅐": 1 / 7, "⅑": 1 / 9, "⅒": 0.1,
  "⅓": 1 / 3, "⅔": 2 / 3, "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
  "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12,
  half: 0.5, quarter: 0.25, third: 1 / 3,
};

/**
 * Units we recognise. Keys are what we normalise to; values are the spellings
 * and abbreviations seen in the wild. Order matters when matching: longer
 * spellings are tried first so "tablespoon" never matches as "t".
 */
const UNITS: Record<string, string[]> = {
  cup: ["cups", "cup", "c"],
  tablespoon: ["tablespoons", "tablespoon", "tbsps", "tbsp", "tbs", "tb", "T"],
  teaspoon: ["teaspoons", "teaspoon", "tsps", "tsp", "ts"],
  ounce: ["ounces", "ounce", "ozs", "oz"],
  "fluid ounce": ["fluid ounces", "fluid ounce", "fl ozs", "fl oz", "fl.oz"],
  pound: ["pounds", "pound", "lbs", "lb"],
  gram: ["grams", "gram", "gr", "g"],
  kilogram: ["kilograms", "kilogram", "kgs", "kg"],
  milliliter: ["milliliters", "millilitres", "milliliter", "millilitre", "mls", "ml"],
  liter: ["liters", "litres", "liter", "litre", "l"],
  pinch: ["pinches", "pinch"],
  dash: ["dashes", "dash"],
  clove: ["cloves", "clove"],
  slice: ["slices", "slice"],
  can: ["cans", "can"],
  jar: ["jars", "jar"],
  package: ["packages", "package", "pkgs", "pkg", "packets", "packet"],
  stick: ["sticks", "stick"],
  bunch: ["bunches", "bunch"],
  sprig: ["sprigs", "sprig"],
  head: ["heads", "head"],
  stalk: ["stalks", "stalk"],
  handful: ["handfuls", "handful"],
  quart: ["quarts", "quart", "qts", "qt"],
  pint: ["pints", "pint", "pts", "pt"],
  gallon: ["gallons", "gallon", "gals", "gal"],
  inch: ["inches", "inch", '"'],
  piece: ["pieces", "piece"],
  large: ["large"],
  medium: ["medium"],
  small: ["small"],
};

/** Units that stay singular when scaled up ("2 cup" reads wrong, "2 g" doesn't). */
const INVARIANT_UNITS = new Set([
  "gram", "kilogram", "milliliter", "liter", "ounce", "fluid ounce", "pound",
  "large", "medium", "small",
]);

const UNIT_LOOKUP = new Map<string, string>();
for (const [canonical, spellings] of Object.entries(UNITS)) {
  for (const spelling of spellings) UNIT_LOOKUP.set(spelling.toLowerCase(), canonical);
}

/** Longest-first so "fluid ounce" beats "ounce". */
const UNIT_PATTERN = [...UNIT_LOOKUP.keys()]
  .sort((a, b) => b.length - a.length)
  .map((u) => u.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&"))
  .join("|");

/** Turns "1 1/2", "1½", "½", "1.5" or "2-3" into a number. Ranges take the low end. */
export function parseQuantity(input: string): number | null {
  let text = input.trim().toLowerCase();
  if (!text) return null;

  // "2-3" or "2 to 3" -> take the lower bound, which is what cooks reach for.
  const range = text.match(/^([\d.,/\s¼-¾⅐-⅞]+?)\s*(?:-|–|—|to)\s*[\d.,/\s¼-¾⅐-⅞]+$/);
  if (range) text = range[1].trim();

  // Split a leading whole number away from a trailing vulgar fraction: "1½".
  let total = 0;
  let matched = false;

  const vulgarMatch = text.match(/[¼-¾⅐-⅞]/);
  if (vulgarMatch) {
    const symbol = vulgarMatch[0];
    const whole = text.slice(0, vulgarMatch.index).trim().replace(/,/g, "");
    if (whole) {
      const n = Number(whole);
      if (!Number.isNaN(n)) total += n;
      else return null;
    }
    total += VULGAR[symbol];
    return total;
  }

  // "1 1/2" or "1/2"
  const mixed = text.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);

  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);

  const decimal = text.replace(/,/g, ".").match(/^\d*\.?\d+$/);
  if (decimal) {
    const n = Number(decimal[0]);
    if (!Number.isNaN(n)) return n;
  }

  if (text in WORD_NUMBERS) {
    total = WORD_NUMBERS[text];
    matched = true;
  }

  return matched ? total : null;
}

const NICE_FRACTIONS: [number, string][] = [
  [1 / 8, "⅛"], [1 / 6, "⅙"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"],
  [1 / 2, "½"], [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [5 / 6, "⅚"],
  [7 / 8, "⅞"],
];

/** Renders 1.5 as "1½" and 0.333 as "⅓" — how a recipe would actually write it. */
export function formatQuantity(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "";
  if (value === 0) return "0";

  // Large or awkward amounts read better as decimals than as eighths.
  if (value >= 100) return String(Math.round(value));

  const whole = Math.floor(value);
  const remainder = value - whole;

  if (remainder < 0.02) return String(whole);

  let best: string | null = null;
  let bestError = 0.03; // tolerance: anything closer than this is "the" fraction
  for (const [amount, symbol] of NICE_FRACTIONS) {
    const error = Math.abs(remainder - amount);
    if (error < bestError) {
      bestError = error;
      best = symbol;
    }
  }

  if (best) return whole > 0 ? `${whole}${best}` : best;

  // No tidy fraction: show at most two decimals, trimmed.
  return String(Math.round(value * 100) / 100);
}

/**
 * How each unit is written on screen. Measures that a recipe would abbreviate
 * stay abbreviated ("115 g", "2 tbsp"); the ones it would spell out are
 * pluralised instead ("2 cups", "3 cloves").
 */
const SHORT_UNITS: Record<string, string> = {
  gram: "g",
  kilogram: "kg",
  milliliter: "ml",
  liter: "L",
  ounce: "oz",
  "fluid ounce": "fl oz",
  pound: "lb",
  tablespoon: "tbsp",
  teaspoon: "tsp",
  inch: "in",
};

export function formatUnit(unit: string | null, quantity: number | null): string {
  if (!unit) return "";
  if (unit in SHORT_UNITS) return SHORT_UNITS[unit];
  if (INVARIANT_UNITS.has(unit)) return unit;
  if (quantity !== null && quantity > 1) {
    if (unit.endsWith("h") || unit.endsWith("s")) return `${unit}es`;
    return `${unit}s`;
  }
  return unit;
}

/**
 * Parses a written ingredient line into its parts. Anything it can't confidently
 * split stays in `item`, so a line is never silently dropped.
 */
export function parseIngredientLine(line: string, group: string | null = null): Ingredient {
  const raw = line.trim().replace(/^[-*•·–—•]\s*/, "").trim();
  let rest = raw;

  // Leading quantity: digits, fractions, vulgar fractions, ranges, or a number word.
  const quantityMatch = rest.match(
    /^((?:\d+[\d.,]*\s*)?(?:\d+\s*\/\s*\d+|[¼-¾⅐-⅞])|\d+[\d.,]*(?:\s*(?:-|–|—|to)\s*\d+[\d.,]*)?|[¼-¾⅐-⅞])\s*/,
  );

  let quantity: number | null = null;
  if (quantityMatch) {
    quantity = parseQuantity(quantityMatch[1]);
    if (quantity !== null) rest = rest.slice(quantityMatch[0].length);
  } else {
    const wordMatch = rest.match(/^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen)\s+/i);
    if (wordMatch) {
      const candidate = WORD_NUMBERS[wordMatch[1].toLowerCase()];
      // "a pinch of salt" is a quantity; "an apple" we leave as prose.
      if (candidate !== undefined && /^(?:a|an)$/i.test(wordMatch[1])) {
        const afterArticle = rest.slice(wordMatch[0].length);
        if (new RegExp(`^(?:${UNIT_PATTERN})\\b`, "i").test(afterArticle)) {
          quantity = candidate;
          rest = afterArticle;
        }
      } else if (candidate !== undefined) {
        quantity = candidate;
        rest = rest.slice(wordMatch[0].length);
      }
    }
  }

  // A parenthetical size right after the amount: "1 (14 oz) can tomatoes".
  const paren = rest.match(/^\(([^)]*)\)\s*/);
  let parenNote: string | null = null;
  if (paren) {
    parenNote = paren[1].trim();
    rest = rest.slice(paren[0].length);
  }

  let unit: string | null = null;
  const unitMatch = rest.match(new RegExp(`^(${UNIT_PATTERN})\\b\\.?\\s*`, "i"));
  if (unitMatch) {
    unit = UNIT_LOOKUP.get(unitMatch[1].toLowerCase().replace(/\.$/, "")) ?? null;
    if (unit) rest = rest.slice(unitMatch[0].length);
  }

  rest = rest.replace(/^of\s+/i, "").trim();

  // Everything after the first comma is preparation, not shopping.
  let note: string | null = null;
  const commaIndex = rest.indexOf(",");
  if (commaIndex > 0) {
    note = rest.slice(commaIndex + 1).trim() || null;
    rest = rest.slice(0, commaIndex).trim();
  }

  // Trailing prep written without a comma: "garlic finely chopped".
  const trailingPrep = rest.match(
    /\s+((?:finely |roughly |thinly |coarsely |freshly )?(?:chopped|minced|diced|sliced|grated|shredded|melted|softened|beaten|drained|rinsed|peeled|crushed|cubed|julienned|halved|quartered|toasted|divided|packed|sifted|room temperature)(?:\s+\w+)?)$/i,
  );
  if (trailingPrep) {
    note = note ? `${trailingPrep[1]}, ${note}` : trailingPrep[1];
    rest = rest.slice(0, trailingPrep.index).trim();
  }

  if (parenNote) note = note ? `${parenNote}, ${note}` : parenNote;

  return {
    quantity,
    unit,
    item: rest || raw,
    note,
    group,
    raw,
  };
}

/** Scales an ingredient and renders it as a line of text. */
export function formatIngredient(ingredient: Ingredient, factor = 1): string {
  const scaled = ingredient.quantity === null ? null : ingredient.quantity * factor;
  const amount = formatQuantity(scaled);
  const unit = formatUnit(ingredient.unit, scaled);
  return [amount, unit, ingredient.item].filter(Boolean).join(" ");
}

/** True when scaling would change nothing, so the UI can skip the badge. */
export function isScalable(ingredients: Ingredient[]): boolean {
  return ingredients.some((i) => i.quantity !== null);
}
