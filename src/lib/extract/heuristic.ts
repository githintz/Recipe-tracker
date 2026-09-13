import type { ExtractedRecipe, Ingredient, Step } from "../types";
import { parseIngredientLine, parseQuantity } from "../quantity";

const INGREDIENT_HEADINGS =
  /^\s*(?:#+\s*)?(?:\*\*)?\s*(ingredients?|you(?:'| )?ll need|what you need|shopping list|for the [\w\s-]+|the [\w\s-]+ (?:sauce|dough|filling|topping|marinade|dressing|batter|glaze|crust))\s*:?\s*(?:\*\*)?\s*$/i;

const STEP_HEADINGS =
  /^\s*(?:#+\s*)?(?:\*\*)?\s*(instructions?|directions?|method|steps?|how to(?: make it)?|preparation|to (?:make|assemble|serve|finish))\s*:?\s*(?:\*\*)?\s*$/i;

const NOTE_HEADINGS = /^\s*(?:\*\*)?\s*(notes?|tips?|storage|to store|make ahead)\s*:?\s*(?:\*\*)?\s*$/i;

/** Verbs that open a cooking instruction. Used to tell steps from ingredients. */
const STEP_VERBS = new RegExp(
  `^(?:then\\s+|next\\s+|now\\s+|finally\\s+|meanwhile,?\\s+|carefully\\s+)?(?:` +
    [
      "add", "arrange", "assemble", "bake", "beat", "blend", "boil", "break",
      "bring", "broil", "brown", "brush", "chill", "chop", "combine", "cook",
      "cool", "cover", "cream", "cut", "deglaze", "dice", "dip", "divide",
      "drain", "drizzle", "dust", "fill", "flip", "fold", "form", "freeze",
      "fry", "garnish", "grate", "grease", "grill", "heat", "knead", "layer",
      "let", "line", "marinate", "mash", "melt", "mix", "pat", "peel", "place",
      "pour", "prehe?at", "press", "puree", "reduce", "refrigerate", "remove",
      "repeat", "rest", "return", "roast", "roll", "rub", "saute", "sauté",
      "scoop", "season", "serve", "set", "shape", "simmer", "slice", "spoon",
      "spread", "sprinkle", "squeeze", "stir", "strain", "taste", "toast",
      "top", "toss", "transfer", "turn", "using", "warm", "wash", "whisk",
      "wipe", "wrap",
    ].join("|") +
    ")\\b",
  "i",
);

const MEASURE_START =
  /^\s*(?:[-*•·–—]\s*)?(?:\d|[¼-¾⅐-⅞]|a\s+(?:pinch|dash|handful|few)\b|salt\b|pepper\b|to taste\b)/i;

export type HeuristicOptions = {
  /** Used when the text has no obvious title line. */
  fallbackTitle?: string;
};

/**
 * Turns free-form recipe text — a caption, a pasted blog excerpt, a note — into
 * a structured recipe. Works in two passes: look for explicit "Ingredients" /
 * "Instructions" headings first, and if there are none, classify each line on
 * its own shape. Never drops a line: anything it can't place becomes a note.
 */
export function fromText(
  input: string,
  options: HeuristicOptions = {},
): ExtractedRecipe {
  const text = input.replace(/\r\n/g, "\n").replace(/ /g, " ").trim();
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const tags = extractHashtags(text);
  const body = lines.map(stripHashtagOnlyLine).filter((l): l is string => l !== null);

  const { title, startIndex } = findTitle(body, options.fallbackTitle);

  const ingredientLines: { line: string; group: string | null }[] = [];
  const stepLines: { line: string; group: string | null }[] = [];
  const noteLines: string[] = [];

  let mode: "unknown" | "ingredients" | "steps" | "notes" = "unknown";
  let group: string | null = null;
  let sawHeading = false;

  for (const rawLine of body.slice(startIndex)) {
    const line = rawLine.replace(/^\s*[-*•·–—]\s*/, "").trim();
    if (!line) continue;

    const ingredientHeading = rawLine.match(INGREDIENT_HEADINGS);
    if (ingredientHeading) {
      mode = "ingredients";
      sawHeading = true;
      const label = ingredientHeading[1];
      group = /^ingredients?$|^you|^what you|^shopping/i.test(label)
        ? null
        : titleCase(label);
      continue;
    }

    if (STEP_HEADINGS.test(rawLine)) {
      mode = "steps";
      sawHeading = true;
      group = null;
      continue;
    }

    if (NOTE_HEADINGS.test(rawLine)) {
      mode = "notes";
      sawHeading = true;
      group = null;
      continue;
    }

    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);

    if (mode === "notes") {
      noteLines.push(line);
      continue;
    }
    if (mode === "ingredients") {
      ingredientLines.push({ line, group });
      continue;
    }
    if (mode === "steps") {
      stepLines.push({ line: numbered ? numbered[2] : line, group });
      continue;
    }

    // No headings yet — decide from the shape of the line itself.
    if (numbered) {
      stepLines.push({ line: numbered[2], group });
    } else if (looksLikeIngredient(line)) {
      ingredientLines.push({ line, group });
    } else if (looksLikeStep(line)) {
      stepLines.push({ line, group });
    } else if (line.length > 120) {
      stepLines.push({ line, group });
    } else {
      noteLines.push(line);
    }
  }

  // A heading-less caption often lists ingredients first, then the method as a
  // block of prose. If we found ingredients but no steps, look for prose.
  let steps: Step[] = stepLines.map(({ line, group: g }) => ({ text: line, group: g }));
  if (!steps.length && noteLines.length) {
    const prose = noteLines.filter((line) => line.length > 60 || looksLikeStep(line));
    if (prose.length) {
      steps = prose.map((line) => ({ text: line, group: null }));
      for (const line of prose) noteLines.splice(noteLines.indexOf(line), 1);
    }
  }

  // A single long paragraph of method: split it into sentences.
  if (steps.length === 1 && steps[0].text.length > 220) {
    steps = splitSentences(steps[0].text).map((s) => ({ text: s, group: null }));
  }

  const ingredients: Ingredient[] = ingredientLines.map(({ line, group: g }) =>
    parseIngredientLine(line, g),
  );

  const warnings: string[] = [];
  if (!ingredients.length) warnings.push("No ingredient list was found in the text.");
  if (!steps.length) warnings.push("No method was found in the text.");
  if (!sawHeading && ingredients.length && steps.length) {
    warnings.push("Sections were guessed from the layout — worth a quick check.");
  }

  const times = extractTimes(text);

  return {
    title,
    description: null,
    imageUrl: null,
    sourceUrl: null,
    sourceName: null,
    author: null,
    sourceType: "text",
    servings: extractServings(text),
    servingsNoun: "servings",
    prepMinutes: times.prep,
    cookMinutes: times.cook,
    totalMinutes: times.total,
    ingredients,
    steps,
    notes: noteLines.length ? noteLines.join("\n") : null,
    tags,
    nutrition: null,
    extractedBy: "heuristic",
    warnings,
  };
}

function looksLikeIngredient(line: string): boolean {
  if (line.length > 110) return false;
  if (STEP_VERBS.test(line) && line.length > 45) return false;
  if (MEASURE_START.test(line)) return true;

  // "Flour - 2 cups" and "Butter: 100g" are common in captions.
  if (/^[\w\s()'-]{2,40}\s*[-–—:]\s*[\d¼-¾⅐-⅞]/.test(line)) return true;

  // A short line with a quantity anywhere in it.
  const firstToken = line.split(/\s+/)[0];
  if (parseQuantity(firstToken) !== null) return true;

  return false;
}

function looksLikeStep(line: string): boolean {
  if (STEP_VERBS.test(line)) return true;
  // A sentence with a verb and a length that reads like prose.
  return line.length > 60 && /\s(?:until|then|about|for)\s/i.test(line);
}

function findTitle(
  lines: string[],
  fallback?: string,
): { title: string; startIndex: number } {
  for (let i = 0; i < Math.min(lines.length, 3); i += 1) {
    const line = lines[i]
      .replace(/^[#\s*]+/, "")
      .replace(/[*]+$/, "")
      .trim();

    if (!line) continue;
    if (INGREDIENT_HEADINGS.test(lines[i]) || STEP_HEADINGS.test(lines[i])) break;
    if (looksLikeIngredient(line) || /^\d+[.)]/.test(line)) break;
    if (line.length > 90) break;

    return { title: cleanTitle(line), startIndex: i + 1 };
  }

  return { title: fallback?.trim() || "Untitled recipe", startIndex: 0 };
}

function cleanTitle(line: string): string {
  return line
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s*[-–—|]\s*(?:recipe|easy|quick)\s*$/i, "")
    .replace(/^recipe:\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 120) || "Untitled recipe";
}

function titleCase(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function stripHashtagOnlyLine(line: string): string | null {
  const withoutTags = line.replace(/#[\w-]+/g, "").trim();
  if (!withoutTags && line.includes("#")) return null;
  return withoutTags || line;
}

function extractHashtags(text: string): string[] {
  const skip = /^(recipe|recipes|food|foodie|cooking|reels?|fyp|viral|foryou|foryoupage|tiktok|instagram|easy|yum|delicious|homemade)$/i;
  const tags = [...text.matchAll(/#([\p{L}][\p{L}\d_-]{2,24})/gu)]
    .map((m) => m[1].toLowerCase())
    .filter((tag) => !skip.test(tag));
  return [...new Set(tags)].slice(0, 6);
}

function extractServings(text: string): number | null {
  const patterns = [
    /\b(?:serves|servings?|yields?|makes|feeds)\s*:?\s*(?:about\s+)?(\d+(?:\.\d+)?)/i,
    /\b(\d+)\s*(?:servings?|portions?)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const n = Number(match[1]);
      if (n > 0 && n < 200) return n;
    }
  }
  return null;
}

function extractTimes(text: string): {
  prep: number | null;
  cook: number | null;
  total: number | null;
} {
  const read = (label: RegExp): number | null => {
    const match = text.match(label);
    if (!match) return null;
    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    const total = hours * 60 + minutes;
    return total > 0 ? total : null;
  };

  const pattern = (name: string) =>
    new RegExp(
      `${name}\\s*(?:time)?\\s*:?\\s*(?:(\\d+)\\s*(?:hours?|hrs?|h)\\b)?\\s*(?:(\\d+)\\s*(?:minutes?|mins?|m)\\b)?`,
      "i",
    );

  const prep = read(pattern("prep"));
  const cook = read(pattern("(?:cook|bake|bak(?:e|ing))"));
  const total = read(pattern("total")) ?? (prep && cook ? prep + cook : null);

  return { prep, cook, total };
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}
