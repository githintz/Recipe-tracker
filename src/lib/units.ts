import type { Ingredient } from "./types";
import { formatQuantity, formatUnit } from "./quantity";

export type UnitSystem = "original" | "metric" | "us";

export const UNIT_SYSTEM_LABEL: Record<UnitSystem, string> = {
  original: "As written",
  metric: "Metric",
  us: "US cups",
};

/** Volume units expressed in millilitres. */
const VOLUME_ML: Record<string, number> = {
  teaspoon: 4.93,
  tablespoon: 14.79,
  "fluid ounce": 29.57,
  cup: 236.6,
  pint: 473.2,
  quart: 946.4,
  gallon: 3785.4,
  milliliter: 1,
  liter: 1000,
};

/** Weight units expressed in grams. */
const WEIGHT_G: Record<string, number> = {
  ounce: 28.35,
  pound: 453.6,
  gram: 1,
  kilogram: 1000,
};

const METRIC_UNITS = new Set(["milliliter", "liter", "gram", "kilogram"]);

/** Rounds to something a cook can measure rather than a raw conversion. */
function tidy(value: number): number {
  if (value >= 500) return Math.round(value / 25) * 25;
  if (value >= 100) return Math.round(value / 10) * 10;
  if (value >= 20) return Math.round(value / 5) * 5;
  if (value >= 10) return Math.round(value);
  return Math.round(value * 2) / 2;
}

/**
 * Converts one ingredient into the requested system. Anything that has no
 * sensible equivalent — "2 cloves garlic", "a pinch of salt" — is returned
 * untouched, because inventing grams for a clove helps nobody.
 */
export function convertIngredient(
  ingredient: Ingredient,
  system: UnitSystem,
  factor = 1,
): { quantity: number | null; unit: string | null } {
  const quantity =
    ingredient.quantity === null ? null : ingredient.quantity * factor;
  const unit = ingredient.unit;

  if (system === "original" || quantity === null || !unit) {
    return { quantity, unit };
  }

  if (system === "metric") {
    if (METRIC_UNITS.has(unit)) return { quantity, unit };

    if (unit in VOLUME_ML) {
      const ml = quantity * VOLUME_ML[unit];
      return ml >= 1000
        ? { quantity: Math.round((ml / 1000) * 100) / 100, unit: "liter" }
        : { quantity: tidy(ml), unit: "milliliter" };
    }
    if (unit in WEIGHT_G) {
      const grams = quantity * WEIGHT_G[unit];
      return grams >= 1000
        ? { quantity: Math.round((grams / 1000) * 100) / 100, unit: "kilogram" }
        : { quantity: tidy(grams), unit: "gram" };
    }
    return { quantity, unit };
  }

  // US: millilitres become spoons and cups, grams become ounces and pounds.
  if (unit === "milliliter" || unit === "liter") {
    const ml = quantity * VOLUME_ML[unit];
    if (ml < 15) return { quantity: round(ml / VOLUME_ML.teaspoon, 4), unit: "teaspoon" };
    if (ml < 60) return { quantity: round(ml / VOLUME_ML.tablespoon, 4), unit: "tablespoon" };
    return { quantity: round(ml / VOLUME_ML.cup, 8), unit: "cup" };
  }
  if (unit === "gram" || unit === "kilogram") {
    const grams = quantity * WEIGHT_G[unit];
    return grams >= 454
      ? { quantity: round(grams / WEIGHT_G.pound, 8), unit: "pound" }
      : { quantity: round(grams / WEIGHT_G.ounce, 4), unit: "ounce" };
  }

  return { quantity, unit };
}

/** Rounds to the nearest 1/denominator, so cups land on halves and eighths. */
function round(value: number, denominator: number): number {
  return Math.round(value * denominator) / denominator;
}

/** Renders an ingredient in the chosen system, scaled by `factor`. */
export function renderIngredient(
  ingredient: Ingredient,
  system: UnitSystem,
  factor = 1,
): string {
  const { quantity, unit } = convertIngredient(ingredient, system, factor);
  const amount = formatQuantity(quantity);
  const unitText = formatUnit(unit, quantity);
  return [amount, unitText].filter(Boolean).join(" ");
}

/** True when at least one ingredient would actually change under conversion. */
export function isConvertible(ingredients: Ingredient[]): boolean {
  return ingredients.some(
    (ingredient) =>
      ingredient.quantity !== null &&
      ingredient.unit !== null &&
      (ingredient.unit in VOLUME_ML || ingredient.unit in WEIGHT_G),
  );
}
