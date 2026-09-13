import type { ExtractedRecipe, Ingredient, Nutrition, Step } from "../types";
import { decodeEntities, htmlToText, jsonLdBlocks } from "./html";
import { parseIngredientLine } from "../quantity";
import { hostLabel } from "./fetch";

type Json = Record<string, unknown>;

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function typesOf(node: Json): string[] {
  return asArray(node["@type"]).map((t) => String(t).toLowerCase());
}

/** Walks a JSON-LD document, including @graph containers, for a Recipe node. */
function findRecipeNode(input: unknown, depth = 0): Json | null {
  if (depth > 8 || input === null || typeof input !== "object") return null;

  if (Array.isArray(input)) {
    for (const entry of input) {
      const found = findRecipeNode(entry, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const node = input as Json;
  if (typesOf(node).includes("recipe")) return node;

  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement"]) {
    if (key in node) {
      const found = findRecipeNode(node[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const clean = htmlToText(value).trim();
    return clean || null;
  }
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(text).filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof value === "object") {
    const node = value as Json;
    return text(node.name ?? node.text ?? node["@value"] ?? node.url);
  }
  return null;
}

/** ISO-8601 durations ("PT1H30M") are how schema.org states times. */
export function parseDuration(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return null;

  const iso = value.trim().match(/^P(?:([\d.]+)D)?(?:T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:[\d.]+S)?)?$/i);
  if (iso) {
    const days = Number(iso[1] ?? 0);
    const hours = Number(iso[2] ?? 0);
    const minutes = Number(iso[3] ?? 0);
    const total = days * 1440 + hours * 60 + minutes;
    return total > 0 ? Math.round(total) : null;
  }

  // Plain English: "1 hr 30 mins", "45 minutes".
  const hours = value.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  const minutes = value.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/i);
  if (hours || minutes) {
    const total = Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0);
    return total > 0 ? Math.round(total) : null;
  }

  const bare = value.trim().match(/^(\d+)$/);
  return bare ? Number(bare[1]) : null;
}

/** "4 servings", "Serves 6", "6-8" all mean a number we can scale from. */
export function parseServings(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 && n < 1000 ? n : null;
}

function imageFrom(value: unknown): string | null {
  const entries = asArray(value);
  for (const entry of entries) {
    if (typeof entry === "string" && entry.startsWith("http")) return entry;
    if (entry && typeof entry === "object") {
      const node = entry as Json;
      const url = node.url ?? node.contentUrl ?? node["@id"];
      if (typeof url === "string" && url.startsWith("http")) return url;
    }
  }
  return null;
}

/** Instructions come as strings, HowToStep objects, or HowToSection groups. */
function stepsFrom(value: unknown): Step[] {
  const steps: Step[] = [];

  const walk = (input: unknown, group: string | null) => {
    for (const entry of asArray(input)) {
      if (typeof entry === "string") {
        // A single blob of prose: split it into sentences-as-steps.
        const clean = htmlToText(entry).trim();
        if (!clean) continue;
        const lines = clean.split(/\n+/).map((l) => l.trim()).filter(Boolean);
        if (lines.length > 1) {
          for (const line of lines) {
            steps.push({ text: line.replace(/^\d+[.)]\s*/, ""), group });
          }
        } else {
          steps.push({ text: clean, group });
        }
        continue;
      }

      if (!entry || typeof entry !== "object") continue;
      const node = entry as Json;
      const types = typesOf(node);

      if (types.includes("howtosection")) {
        const name = text(node.name);
        walk(node.itemListElement ?? node.steps ?? node.text, name);
        continue;
      }

      const body = text(node.text ?? node.name ?? node.description);
      if (body) steps.push({ text: body, group });
    }
  };

  walk(value, null);

  return steps
    .map((step) => ({ ...step, text: step.text.replace(/\s+/g, " ").trim() }))
    .filter((step) => step.text.length > 1);
}

function ingredientsFrom(value: unknown): Ingredient[] {
  return asArray(value)
    .map((entry) => text(entry))
    .filter((line): line is string => Boolean(line && line.trim()))
    .map((line) => parseIngredientLine(line));
}

function nutritionFrom(value: unknown): Nutrition | null {
  if (!value || typeof value !== "object") return null;
  const node = value as Json;

  const number = (raw: unknown): number | null => {
    const asText = text(raw);
    if (!asText) return null;
    const match = asText.match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  };

  const nutrition: Nutrition = {
    calories: number(node.calories),
    protein: number(node.proteinContent),
    carbs: number(node.carbohydrateContent),
    fat: number(node.fatContent),
    fiber: number(node.fiberContent),
    sugar: number(node.sugarContent),
    sodium: number(node.sodiumContent),
    source: "source",
  };

  const hasAny = Object.entries(nutrition).some(
    ([key, val]) => key !== "source" && val !== null,
  );
  return hasAny ? nutrition : null;
}

function tagsFrom(node: Json): string[] {
  const raw = [
    ...asArray(node.recipeCategory),
    ...asArray(node.recipeCuisine),
    ...asArray(node.keywords),
  ]
    .flatMap((entry) => {
      const asText = text(entry);
      return asText ? asText.split(/[,;]/) : [];
    })
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 1 && tag.length < 30);

  return [...new Set(raw)].slice(0, 8);
}

/** Reads a schema.org Recipe out of a page's JSON-LD, if it has one. */
export function fromJsonLd(html: string, url: string): ExtractedRecipe | null {
  for (const block of jsonLdBlocks(html)) {
    const node = findRecipeNode(block);
    if (!node) continue;

    const title = text(node.name);
    const ingredients = ingredientsFrom(node.recipeIngredient ?? node.ingredients);
    const steps = stepsFrom(node.recipeInstructions);

    if (!title || (!ingredients.length && !steps.length)) continue;

    const prep = parseDuration(node.prepTime);
    const cook = parseDuration(node.cookTime);
    const total = parseDuration(node.totalTime) ?? (prep !== null && cook !== null ? prep + cook : null);

    const author = text(node.author);

    return {
      title: decodeEntities(title).trim(),
      description: text(node.description),
      imageUrl: imageFrom(node.image),
      sourceUrl: url,
      sourceName: hostLabel(url) || null,
      author,
      sourceType: "web",
      servings: parseServings(node.recipeYield ?? node.yield),
      servingsNoun: "servings",
      prepMinutes: prep,
      cookMinutes: cook,
      totalMinutes: total,
      ingredients,
      steps,
      notes: null,
      tags: tagsFrom(node),
      nutrition: nutritionFrom(node.nutrition),
      extractedBy: "structured-data",
      warnings: steps.length
        ? []
        : ["The page listed ingredients but no method — check the original link."],
    };
  }

  return null;
}
