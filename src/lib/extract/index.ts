import type { ExtractedRecipe } from "../types";
import { FetchError, fetchPage, hostLabel, normalizeUrl } from "./fetch";
import { fromJsonLd } from "./jsonld";
import { fromMicrodata } from "./microdata";
import { fromText } from "./heuristic";
import { detectPlatform, fetchSocialPost, platformLabel } from "./social";
import {
  extractFromImage,
  extractWithLlm,
  isLlmAvailable,
  MissingKeyError,
  NotARecipeError,
} from "./llm";
import { htmlToText, metaContent, pageTitle } from "./html";
import { estimateNutrition } from "../nutrition";

export { NotARecipeError, MissingKeyError };
export { isLlmAvailable };

export class ImportError extends Error {
  constructor(
    message: string,
    /** Shown under the error so the user knows what to try instead. */
    readonly hint?: string,
    /** What each attempt actually returned — surfaced behind "Show details". */
    readonly details?: string[],
  ) {
    super(message);
    this.name = "ImportError";
  }
}

/** Fills in nutrition and tidies fields common to every import path. */
function finish(recipe: ExtractedRecipe): ExtractedRecipe {
  const nutrition =
    recipe.nutrition ?? estimateNutrition(recipe.ingredients, recipe.servings);

  const total =
    recipe.totalMinutes ??
    (recipe.prepMinutes !== null && recipe.cookMinutes !== null
      ? recipe.prepMinutes + recipe.cookMinutes
      : null);

  return {
    ...recipe,
    title: recipe.title.trim().slice(0, 200) || "Untitled recipe",
    totalMinutes: total,
    nutrition,
    tags: [...new Set(recipe.tags.map((t) => t.toLowerCase().trim()).filter(Boolean))],
  };
}

/** Trims a page down to the part likely to hold the recipe before sending it on. */
function readablePageText(html: string): string {
  const text = htmlToText(html);
  const lines = text.split("\n");

  // Most of a food blog is navigation and comments; the recipe sits between the
  // first ingredient-ish line and the end of the method.
  const start = lines.findIndex((line) => /^ingredients?\b/i.test(line.trim()));
  if (start === -1) return text.slice(0, 30_000);

  const tail = lines.slice(start, start + 220).join("\n");
  const head = lines.slice(Math.max(0, start - 15), start).join("\n");
  return `${head}\n${tail}`.slice(0, 30_000);
}

export async function importFromUrl(rawUrl: string): Promise<ExtractedRecipe> {
  let url: string;
  try {
    url = normalizeUrl(rawUrl);
  } catch {
    throw new ImportError("That doesn't look like a link.", "Paste a full URL, like https://…");
  }

  const platform = detectPlatform(url);

  // Social platforms need several attempts under different user agents, so
  // they fetch inside their own importer rather than being handed one page.
  if (platform !== "web") return finish(await importSocialPost(url, platform));

  let page;
  try {
    page = await fetchPage(url);
  } catch (error) {
    const detail = error instanceof FetchError ? error.message : "Could not open that link.";
    throw new ImportError(
      `Couldn't open ${hostLabel(url) || "that link"}. ${detail}`,
      "Check the link, or copy the recipe text and use Paste text instead.",
    );
  }

  return finish(await importWebPage(page.html, url));
}

async function importWebPage(html: string, url: string): Promise<ExtractedRecipe> {
  // 1. Structured data is exact when a site publishes it, so it always wins.
  const structured = fromJsonLd(html, url);
  if (structured && structured.ingredients.length) return structured;

  // 2. Microdata: older blogs that never moved to JSON-LD.
  const microdata = fromMicrodata(html, url);
  if (microdata && microdata.ingredients.length) return microdata;

  // 3. Nothing machine-readable — read the page like a person would.
  const base: Partial<ExtractedRecipe> = {
    imageUrl: metaContent(html, "og:image"),
    sourceUrl: url,
    sourceName: metaContent(html, "og:site_name") ?? hostLabel(url) ?? null,
    description: metaContent(html, "og:description"),
    sourceType: "web",
  };

  const text = readablePageText(html);
  const title = pageTitle(html) ?? "Imported recipe";

  if (isLlmAvailable()) {
    try {
      return await extractWithLlm(`Title: ${title}\nFrom: ${url}\n\n${text}`, base);
    } catch (error) {
      if (error instanceof NotARecipeError) throw error;
      // Fall through to the offline parser rather than failing the import.
    }
  }

  const parsed = fromText(text, { fallbackTitle: title });
  if (!parsed.ingredients.length && !parsed.steps.length) {
    throw new ImportError(
      `No recipe was found on ${hostLabel(url)}.`,
      isLlmAvailable()
        ? "The page may build its recipe with JavaScript. Copy the recipe text and use Paste text instead."
        : "Add a Claude API key in Settings to read pages that publish no structured data, or use Paste text.",
    );
  }

  return { ...parsed, ...base, title: parsed.title || title };
}

async function importSocialPost(
  url: string,
  platform: ReturnType<typeof detectPlatform>,
): Promise<ExtractedRecipe> {
  const post = await fetchSocialPost(url, platform);

  if (!post.caption) {
    throw new ImportError(
      `${platformLabel(platform)} didn't give up a caption for that post.`,
      "Sign-in walls are the usual cause, and private or age-restricted posts " +
        "can't be read at all. Copying the caption and using Paste text always works.",
      post.diagnostics,
    );
  }

  const base: Partial<ExtractedRecipe> = {
    imageUrl: post.thumbnail,
    sourceUrl: url,
    sourceName: platformLabel(platform),
    author: post.author,
    sourceType: platform,
  };

  if (isLlmAvailable()) {
    try {
      const context = [
        post.author ? `Posted by: ${post.author}` : null,
        post.title ? `Post title: ${post.title}` : null,
        `Caption:\n${post.caption}`,
      ]
        .filter(Boolean)
        .join("\n");
      return await extractWithLlm(context, base);
    } catch (error) {
      if (error instanceof NotARecipeError) throw error;
    }
  }

  const parsed = fromText(post.caption, {
    fallbackTitle: post.title ?? `Recipe from ${platformLabel(platform)}`,
  });

  if (!parsed.ingredients.length && !parsed.steps.length) {
    throw new ImportError(
      "That caption doesn't contain a written recipe.",
      "Creators often say the recipe out loud without writing it down. Check the comments or the creator's link.",
    );
  }

  return {
    ...parsed,
    ...base,
    title: parsed.title,
    warnings: [
      ...parsed.warnings,
      ...(isLlmAvailable()
        ? []
        : ["Parsed without AI — add a Claude API key in Settings for cleaner caption imports."]),
    ],
  };
}

/** Import from text the user pasted (a caption, a note, a message from a friend). */
export async function importFromText(text: string): Promise<ExtractedRecipe> {
  const trimmed = text.trim();
  if (trimmed.length < 20) {
    throw new ImportError(
      "That's too short to be a recipe.",
      "Paste the whole thing — ingredients and method.",
    );
  }

  // A bare link pasted into the text box should behave like a link import.
  if (/^https?:\/\/\S+$/i.test(trimmed)) return importFromUrl(trimmed);

  if (isLlmAvailable()) {
    try {
      return finish(await extractWithLlm(trimmed, { sourceType: "text" }));
    } catch (error) {
      if (error instanceof NotARecipeError) throw error;
    }
  }

  const parsed = fromText(trimmed);
  if (!parsed.ingredients.length && !parsed.steps.length) {
    throw new ImportError(
      "No ingredients or method were found in that text.",
      "Make sure the ingredients and the steps are both included.",
    );
  }
  return finish(parsed);
}

/** Import from a photo of a recipe — a cookbook page, a card, a screenshot. */
export async function importFromImage(
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
): Promise<ExtractedRecipe> {
  if (!isLlmAvailable()) {
    throw new ImportError(
      "Reading a photo needs a Claude API key.",
      "Add one in Settings, or type the recipe in by hand.",
    );
  }
  return finish(await extractFromImage(base64, mediaType));
}

/** A blank recipe for the write-it-yourself path. */
export function emptyRecipe(): ExtractedRecipe {
  return {
    title: "",
    description: null,
    imageUrl: null,
    sourceUrl: null,
    sourceName: null,
    author: null,
    sourceType: "manual",
    servings: 4,
    servingsNoun: "servings",
    prepMinutes: null,
    cookMinutes: null,
    totalMinutes: null,
    ingredients: [],
    steps: [],
    notes: null,
    tags: [],
    nutrition: null,
    extractedBy: "manual",
    warnings: [],
  };
}
