import type { ExtractedRecipe } from "./types";

/** A blank draft for the write-it-yourself path. Safe to import from the client. */
export function emptyRecipeDraft(): ExtractedRecipe {
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
