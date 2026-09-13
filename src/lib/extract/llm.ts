import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ExtractedRecipe, Ingredient, Step } from "../types";
import { parseIngredientLine } from "../quantity";
import { getApiKey } from "../settings";

const MODEL = "claude-opus-5";

const RecipeSchema = z.object({
  is_recipe: z
    .boolean()
    .describe("False if the text is not a recipe at all (an ad, a restaurant review, a caption with no food instructions)."),
  title: z.string().describe("A short dish name. No emoji, no hashtags, no channel name."),
  description: z
    .string()
    .describe("One sentence on what the dish is. Empty string if the source says nothing useful."),
  servings: z
    .number()
    .describe("Number of servings the amounts make. 0 if the source never says."),
  servings_noun: z
    .string()
    .describe("What the yield counts: servings, cookies, pancakes, jars. Default 'servings'."),
  prep_minutes: z.number().describe("Prep time in minutes, 0 if not stated."),
  cook_minutes: z.number().describe("Cook/bake time in minutes, 0 if not stated."),
  ingredients: z
    .array(
      z.object({
        quantity: z
          .string()
          .describe("Amount exactly as written: '1 1/2', '2', '', for 'salt to taste' use ''."),
        unit: z.string().describe("Unit as written: cup, tbsp, g, ''. Empty if there is none."),
        item: z.string().describe("The food itself, with no amount and no preparation."),
        note: z
          .string()
          .describe("Preparation or qualifier: 'finely chopped', 'room temperature'. Empty if none."),
        group: z
          .string()
          .describe("Section heading this belongs to, e.g. 'For the sauce'. Empty if the list is flat."),
      }),
    )
    .describe("Every ingredient mentioned, in source order. Never invent one that is not stated."),
  steps: z
    .array(
      z.object({
        text: z.string().describe("One instruction, as a full sentence."),
        group: z.string().describe("Section heading, e.g. 'To assemble'. Empty if the method is flat."),
      }),
    )
    .describe("The method in order. Split run-on captions into separate steps."),
  notes: z.string().describe("Tips, storage or substitutions the source gives. Empty if none."),
  tags: z
    .array(z.string())
    .describe("2-5 lowercase tags: cuisine, meal, diet. e.g. ['thai','weeknight','vegetarian']."),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("How completely the source stated the recipe."),
  missing: z
    .array(z.string())
    .describe("Anything a cook would need that the source never gave, e.g. 'oven temperature'."),
});

const SYSTEM_PROMPT = `You turn messy recipe sources into clean structured recipes.

Rules that matter:
- Transcribe, never invent. If the source does not state an amount, a time or a temperature, leave it empty and list it under "missing". A plausible guess is worse than a blank, because the cook will trust it.
- Social captions run ingredients and method together in one paragraph. Separate them, and split a run-on method into one instruction per step.
- Keep the writer's own words for the steps. Tidy grammar and drop filler ("you guys are going to LOVE this"), but do not rewrite technique or change amounts.
- Strip emoji, hashtags, handles, follow-me pitches, and links from every field.
- Amounts stay exactly as written: "1 1/2" stays "1 1/2", not 1.5. Ranges stay "2-3".
- Ingredient "item" is what you would buy, with no amount and no prep: "2 cloves garlic, minced" gives item "garlic", note "minced".
- If the text is not a recipe, set is_recipe false and leave the other fields empty.`;

export function isLlmAvailable(): boolean {
  return getApiKey() !== null;
}

/**
 * Built fresh each call so a key added in Settings takes effect immediately.
 * `dangerouslyAllowBrowser` is the honest name for what this is: the request
 * carries the user's own key straight from their device to Anthropic, with no
 * server of ours in between.
 */
function getClient(): Anthropic {
  const apiKey = getApiKey();
  if (!apiKey) throw new MissingKeyError();
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export class MissingKeyError extends Error {
  constructor() {
    super("No Claude API key is set.");
    this.name = "MissingKeyError";
  }
}

type ParsedRecipe = z.infer<typeof RecipeSchema>;

function toExtracted(
  parsed: ParsedRecipe,
  base: Partial<ExtractedRecipe>,
  method: "ai" | "ai-vision",
): ExtractedRecipe {
  const ingredients: Ingredient[] = parsed.ingredients.map((raw) => {
    const rendered = [raw.quantity, raw.unit, raw.item].filter(Boolean).join(" ").trim();
    // Re-run our own parser so units normalise the same way as every other
    // import path — that is what makes scaling and grocery merging work.
    const parsedLine = parseIngredientLine(rendered || raw.item, raw.group || null);
    return {
      ...parsedLine,
      item: raw.item.trim() || parsedLine.item,
      note: raw.note.trim() || parsedLine.note,
      raw: [rendered, raw.note].filter(Boolean).join(", "),
    };
  });

  const steps: Step[] = parsed.steps
    .map((step) => ({ text: step.text.trim(), group: step.group.trim() || null }))
    .filter((step) => step.text.length > 1);

  const prep = parsed.prep_minutes > 0 ? Math.round(parsed.prep_minutes) : null;
  const cook = parsed.cook_minutes > 0 ? Math.round(parsed.cook_minutes) : null;

  const warnings: string[] = [];
  if (parsed.confidence === "low") {
    warnings.push("The source was vague — read it against the original before cooking.");
  }
  for (const item of parsed.missing.slice(0, 4)) {
    warnings.push(`The source never gave the ${item}.`);
  }

  return {
    title: parsed.title.trim() || base.title || "Untitled recipe",
    description: parsed.description.trim() || base.description || null,
    imageUrl: base.imageUrl ?? null,
    sourceUrl: base.sourceUrl ?? null,
    sourceName: base.sourceName ?? null,
    author: base.author ?? null,
    sourceType: base.sourceType ?? "text",
    servings: parsed.servings > 0 ? parsed.servings : null,
    servingsNoun: parsed.servings_noun.trim() || "servings",
    prepMinutes: prep,
    cookMinutes: cook,
    totalMinutes: prep !== null && cook !== null ? prep + cook : null,
    ingredients,
    steps,
    notes: parsed.notes.trim() || null,
    tags: [...new Set(parsed.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 6),
    nutrition: null,
    extractedBy: method,
    warnings,
  };
}

export class NotARecipeError extends Error {
  constructor(message = "That source doesn't look like a recipe.") {
    super(message);
    this.name = "NotARecipeError";
  }
}

/** Reads a recipe out of free text using Claude. */
export async function extractWithLlm(
  text: string,
  base: Partial<ExtractedRecipe> = {},
): Promise<ExtractedRecipe> {
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(RecipeSchema) },
    messages: [
      {
        role: "user",
        content: `Extract the recipe from this source.\n\n<source>\n${text}\n</source>`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Claude could not structure that source.");
  if (!parsed.is_recipe) throw new NotARecipeError();

  return toExtracted(parsed, base, "ai");
}

/** Reads a recipe out of a photo — a cookbook page, a handwritten card, a screenshot. */
export async function extractFromImage(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  base: Partial<ExtractedRecipe> = {},
): Promise<ExtractedRecipe> {
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(RecipeSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          {
            type: "text",
            text:
              "Read the recipe in this image and extract it. Transcribe exactly what is " +
              "printed or written — if part of the page is cut off or unreadable, leave " +
              "those fields empty and say so in 'missing'.",
          },
        ],
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Claude could not read that image.");
  if (!parsed.is_recipe) {
    throw new NotARecipeError("No recipe was visible in that photo.");
  }

  return toExtracted(parsed, { ...base, sourceType: "photo" }, "ai-vision");
}
