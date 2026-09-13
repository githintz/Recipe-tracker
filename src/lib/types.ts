export type Ingredient = {
  /** Numeric amount, already normalised from fractions ("1 1/2" -> 1.5). */
  quantity: number | null;
  /** Unit as written, lowercased and singularised ("cups" -> "cup"). */
  unit: string | null;
  /** What to buy: "all-purpose flour". */
  item: string;
  /** Trailing qualifier: "finely chopped", "at room temperature". */
  note: string | null;
  /** Section heading this ingredient sits under ("For the sauce"). */
  group: string | null;
  /** Original line, kept verbatim so nothing is lost in parsing. */
  raw: string;
};

export type Step = {
  text: string;
  /** Section heading this step sits under ("To assemble"). */
  group: string | null;
};

export type Nutrition = {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  /** Where the numbers came from, so the UI can be honest about estimates. */
  source: "source" | "estimated";
};

export type Recipe = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  author: string | null;
  /** instagram | tiktok | youtube | web | text | photo | manual */
  sourceType: SourceType;
  servings: number | null;
  servingsNoun: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  ingredients: Ingredient[];
  steps: Step[];
  notes: string | null;
  tags: string[];
  nutrition: Nutrition | null;
  favorite: boolean;
  /** How the recipe body was obtained, surfaced in the import result. */
  extractedBy: ExtractionMethod;
  createdAt: string;
  updatedAt: string;
  folderIds?: string[];
};

export type SourceType =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "web"
  | "text"
  | "photo"
  | "manual";

export type ExtractionMethod =
  | "structured-data"
  | "microdata"
  | "caption"
  | "heuristic"
  | "ai"
  | "ai-vision"
  | "manual";

export type Folder = {
  id: string;
  name: string;
  emoji: string;
  createdAt: string;
  recipeCount?: number;
};

export type GroceryItem = {
  id: string;
  /** Display text, e.g. "2 cup buttermilk". */
  text: string;
  quantity: number | null;
  unit: string | null;
  item: string;
  aisle: string;
  checked: boolean;
  recipeId: string | null;
  recipeTitle: string | null;
  createdAt: string;
};

/** What the extractor produces before it becomes a stored Recipe. */
export type ExtractedRecipe = Omit<
  Recipe,
  "id" | "createdAt" | "updatedAt" | "favorite" | "folderIds"
> & {
  /** Non-fatal notes about what the extractor could and couldn't find. */
  warnings: string[];
};
