import type { ExtractedRecipe } from "../types";
import { decodeEntities, htmlToText, metaContent, pageTitle } from "./html";
import { parseIngredientLine } from "../quantity";
import { hostLabel } from "./fetch";
import { parseDuration, parseServings } from "./jsonld";

/** Grabs the text content of every element carrying `itemprop="<prop>"`. */
function itemprops(html: string, prop: string): string[] {
  const results: string[] = [];
  const pattern = new RegExp(
    `<([a-z0-9]+)[^>]*\\bitemprop\\s*=\\s*["'][^"']*\\b${prop}\\b[^"']*["'][^>]*>`,
    "gi",
  );

  for (const match of html.matchAll(pattern)) {
    const tag = match[1];
    const openEnd = (match.index ?? 0) + match[0].length;

    // Self-closing / void elements carry their value in an attribute.
    const attrValue = match[0].match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (attrValue) {
      const value = decodeEntities(attrValue[1]).trim();
      if (value) results.push(value);
      if (/^(meta|link|img|input)$/i.test(tag)) continue;
    }

    // Walk forward counting nesting so we close on the matching tag.
    const scanner = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
    scanner.lastIndex = openEnd;
    let depth = 1;
    let closeStart = -1;
    let step: RegExpExecArray | null;
    while ((step = scanner.exec(html)) !== null) {
      depth += step[1] === "/" ? -1 : 1;
      if (depth === 0) {
        closeStart = step.index;
        break;
      }
      if (scanner.lastIndex > openEnd + 200_000) break; // runaway guard
    }

    const inner = html.slice(openEnd, closeStart === -1 ? openEnd : closeStart);
    const value = htmlToText(inner).trim();
    if (value && !attrValue) results.push(value);
  }

  return results;
}

/**
 * Fallback for pages that mark up a recipe with microdata attributes instead of
 * JSON-LD. Less common than it used to be, but still the difference between a
 * clean import and no import at all on older food blogs.
 */
export function fromMicrodata(html: string, url: string): ExtractedRecipe | null {
  if (!/itemtype\s*=\s*["'][^"']*schema\.org\/Recipe/i.test(html)) return null;

  const ingredientLines = [
    ...itemprops(html, "recipeIngredient"),
    ...itemprops(html, "ingredients"),
  ].filter(Boolean);

  const stepLines = [
    ...itemprops(html, "recipeInstructions"),
    ...itemprops(html, "instructions"),
  ]
    .flatMap((block) => block.split(/\n+/))
    .map((line) => line.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter((line) => line.length > 2);

  if (!ingredientLines.length && !stepLines.length) return null;

  const title =
    itemprops(html, "name")[0] ?? pageTitle(html) ?? "Imported recipe";

  const prep = parseDuration(itemprops(html, "prepTime")[0]);
  const cook = parseDuration(itemprops(html, "cookTime")[0]);
  const total =
    parseDuration(itemprops(html, "totalTime")[0]) ??
    (prep !== null && cook !== null ? prep + cook : null);

  return {
    title: title.trim(),
    description:
      itemprops(html, "description")[0] ?? metaContent(html, "og:description"),
    imageUrl: metaContent(html, "og:image"),
    sourceUrl: url,
    sourceName: hostLabel(url) || null,
    author: itemprops(html, "author")[0] ?? null,
    sourceType: "web",
    servings: parseServings(itemprops(html, "recipeYield")[0]),
    servingsNoun: "servings",
    prepMinutes: prep,
    cookMinutes: cook,
    totalMinutes: total,
    ingredients: ingredientLines.map((line) => parseIngredientLine(line)),
    steps: stepLines.map((text) => ({ text, group: null })),
    notes: null,
    tags: [],
    nutrition: null,
    extractedBy: "microdata",
    warnings: [],
  };
}
