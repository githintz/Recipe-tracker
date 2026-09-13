import type { Ingredient, Recipe, Step } from "./types";
import { formatIngredient, parseIngredientLine } from "./quantity";
import { formatMinutesPlain } from "./format";

/**
 * Ingredients and steps are edited as plain text, one per line, because that is
 * how people actually retype a recipe. A line ending in ":" becomes a section
 * heading, which is how groups survive a round trip through the editor.
 */

export function ingredientsToText(ingredients: Ingredient[]): string {
  const lines: string[] = [];
  let currentGroup: string | null = null;

  for (const ingredient of ingredients) {
    if (ingredient.group !== currentGroup) {
      if (lines.length) lines.push("");
      if (ingredient.group) lines.push(`${ingredient.group}:`);
      currentGroup = ingredient.group;
    }
    const base = formatIngredient(ingredient);
    lines.push(ingredient.note ? `${base}, ${ingredient.note}` : base);
  }

  return lines.join("\n");
}

export function textToIngredients(text: string): Ingredient[] {
  const ingredients: Ingredient[] = [];
  let group: string | null = null;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    // "For the sauce:" — a heading, not an ingredient.
    if (/^[^\d].{0,48}:$/.test(line) && !/\d/.test(line)) {
      group = line.replace(/:$/, "").trim() || null;
      continue;
    }

    ingredients.push(parseIngredientLine(line, group));
  }

  return ingredients;
}

export function stepsToText(steps: Step[]): string {
  const lines: string[] = [];
  let currentGroup: string | null = null;

  for (const step of steps) {
    if (step.group !== currentGroup) {
      if (lines.length) lines.push("");
      if (step.group) lines.push(`${step.group}:`);
      currentGroup = step.group;
    }
    lines.push(step.text);
  }

  return lines.join("\n");
}

export function textToSteps(text: string): Step[] {
  const steps: Step[] = [];
  let group: string | null = null;

  for (const raw of text.split("\n")) {
    const line = raw.trim().replace(/^\d+[.)]\s*/, "");
    if (!line) continue;

    if (/^[^\d].{0,48}:$/.test(line) && line.split(/\s+/).length <= 6) {
      group = line.replace(/:$/, "").trim() || null;
      continue;
    }

    steps.push({ text: line, group });
  }

  return steps;
}

/** A plain-text version of a recipe, for the "copy" and "share" actions. */
export function recipeToPlainText(recipe: Recipe, factor = 1): string {
  const parts: string[] = [recipe.title];

  if (recipe.description) parts.push("", recipe.description);

  const meta: string[] = [];
  if (recipe.servings) {
    const scaled = Math.round(recipe.servings * factor * 100) / 100;
    meta.push(`Serves ${scaled} ${recipe.servingsNoun}`);
  }
  if (recipe.prepMinutes) meta.push(`Prep ${formatMinutesPlain(recipe.prepMinutes)}`);
  if (recipe.cookMinutes) meta.push(`Cook ${formatMinutesPlain(recipe.cookMinutes)}`);
  if (meta.length) parts.push("", meta.join(" · "));

  if (recipe.ingredients.length) {
    parts.push("", "INGREDIENTS");
    let group: string | null = null;
    for (const ingredient of recipe.ingredients) {
      if (ingredient.group !== group) {
        group = ingredient.group;
        if (group) parts.push("", group);
      }
      const base = formatIngredient(ingredient, factor);
      parts.push(`- ${ingredient.note ? `${base}, ${ingredient.note}` : base}`);
    }
  }

  if (recipe.steps.length) {
    parts.push("", "METHOD");
    let group: string | null = null;
    let index = 1;
    for (const step of recipe.steps) {
      if (step.group !== group) {
        group = step.group;
        if (group) parts.push("", group);
      }
      parts.push(`${index}. ${step.text}`);
      index += 1;
    }
  }

  if (recipe.notes) parts.push("", "NOTES", recipe.notes);
  if (recipe.sourceUrl) parts.push("", `Source: ${recipe.sourceUrl}`);

  return parts.join("\n");
}
