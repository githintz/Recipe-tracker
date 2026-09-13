import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ExtractedRecipe,
  Folder,
  GroceryItem,
  Ingredient,
  Nutrition,
  Recipe,
  Step,
} from "./types";
import { aisleFor, aisleOrder } from "./aisle";
import { formatIngredient, parseIngredientLine } from "./quantity";

const DB_PATH =
  process.env.LADLE_DB_PATH ?? path.join(process.cwd(), "data", "ladle.db");

let instance: Database.Database | null = null;

function connect(): Database.Database {
  if (instance) return instance;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      description   TEXT,
      image_url     TEXT,
      source_url    TEXT,
      source_name   TEXT,
      author        TEXT,
      source_type   TEXT NOT NULL DEFAULT 'manual',
      servings      REAL,
      servings_noun TEXT NOT NULL DEFAULT 'servings',
      prep_minutes  INTEGER,
      cook_minutes  INTEGER,
      total_minutes INTEGER,
      ingredients   TEXT NOT NULL DEFAULT '[]',
      steps         TEXT NOT NULL DEFAULT '[]',
      notes         TEXT,
      tags          TEXT NOT NULL DEFAULT '[]',
      nutrition     TEXT,
      favorite      INTEGER NOT NULL DEFAULT 0,
      extracted_by  TEXT NOT NULL DEFAULT 'manual',
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      emoji      TEXT NOT NULL DEFAULT '📁',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folder_recipes (
      folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      added_at  TEXT NOT NULL,
      PRIMARY KEY (folder_id, recipe_id)
    );

    CREATE TABLE IF NOT EXISTS grocery_items (
      id           TEXT PRIMARY KEY,
      text         TEXT NOT NULL,
      quantity     REAL,
      unit         TEXT,
      item         TEXT NOT NULL,
      aisle        TEXT NOT NULL DEFAULT 'Other',
      checked      INTEGER NOT NULL DEFAULT 0,
      recipe_id    TEXT REFERENCES recipes(id) ON DELETE SET NULL,
      recipe_title TEXT,
      created_at   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recipes_updated ON recipes(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_folder_recipes_recipe ON folder_recipes(recipe_id);
  `);

  instance = db;
  return db;
}

type RecipeRow = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  source_url: string | null;
  source_name: string | null;
  author: string | null;
  source_type: string;
  servings: number | null;
  servings_noun: string;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  ingredients: string;
  steps: string;
  notes: string | null;
  tags: string;
  nutrition: string | null;
  favorite: number;
  extracted_by: string;
  created_at: string;
  updated_at: string;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toRecipe(row: RecipeRow, folderIds: string[] = []): Recipe {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    author: row.author,
    sourceType: row.source_type as Recipe["sourceType"],
    servings: row.servings,
    servingsNoun: row.servings_noun,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    totalMinutes: row.total_minutes,
    ingredients: parseJson<Ingredient[]>(row.ingredients, []),
    steps: parseJson<Step[]>(row.steps, []),
    notes: row.notes,
    tags: parseJson<string[]>(row.tags, []),
    nutrition: parseJson<Nutrition | null>(row.nutrition, null),
    favorite: row.favorite === 1,
    extractedBy: row.extracted_by as Recipe["extractedBy"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    folderIds,
  };
}

function folderIdsFor(recipeId: string): string[] {
  const db = connect();
  return db
    .prepare<[string], { folder_id: string }>(
      "SELECT folder_id FROM folder_recipes WHERE recipe_id = ?",
    )
    .all(recipeId)
    .map((r) => r.folder_id);
}

/* ------------------------------------------------------------------ recipes */

export type RecipeQuery = {
  search?: string;
  folderId?: string;
  tag?: string;
  favoritesOnly?: boolean;
  sort?: "recent" | "title" | "time";
};

export function listRecipes(query: RecipeQuery = {}): Recipe[] {
  const db = connect();
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (query.folderId) {
    where.push(
      "r.id IN (SELECT recipe_id FROM folder_recipes WHERE folder_id = @folderId)",
    );
    params.folderId = query.folderId;
  }
  if (query.favoritesOnly) where.push("r.favorite = 1");
  if (query.tag) {
    where.push("lower(r.tags) LIKE @tag");
    params.tag = `%"${query.tag.toLowerCase()}"%`;
  }
  if (query.search?.trim()) {
    // Search the title, description, tags and the ingredient list together, so
    // "the one with miso" finds a recipe whose title never mentions miso.
    where.push(
      "(lower(r.title) LIKE @q OR lower(r.description) LIKE @q OR lower(r.tags) LIKE @q OR lower(r.ingredients) LIKE @q OR lower(r.source_name) LIKE @q)",
    );
    params.q = `%${query.search.trim().toLowerCase()}%`;
  }

  const order =
    query.sort === "title"
      ? "r.title COLLATE NOCASE ASC"
      : query.sort === "time"
        ? "COALESCE(r.total_minutes, r.prep_minutes + r.cook_minutes, 999999) ASC"
        : "r.updated_at DESC";

  const rows = db
    .prepare<Record<string, unknown>, RecipeRow>(
      `SELECT r.* FROM recipes r
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY ${order}`,
    )
    .all(params);

  return rows.map((row) => toRecipe(row, folderIdsFor(row.id)));
}

export function getRecipe(id: string): Recipe | null {
  const db = connect();
  const row = db
    .prepare<[string], RecipeRow>("SELECT * FROM recipes WHERE id = ?")
    .get(id);
  return row ? toRecipe(row, folderIdsFor(id)) : null;
}

export function createRecipe(input: ExtractedRecipe): Recipe {
  const db = connect();
  const now = new Date().toISOString();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO recipes (
       id, title, description, image_url, source_url, source_name, author,
       source_type, servings, servings_noun, prep_minutes, cook_minutes,
       total_minutes, ingredients, steps, notes, tags, nutrition, favorite,
       extracted_by, created_at, updated_at
     ) VALUES (
       @id, @title, @description, @image_url, @source_url, @source_name, @author,
       @source_type, @servings, @servings_noun, @prep_minutes, @cook_minutes,
       @total_minutes, @ingredients, @steps, @notes, @tags, @nutrition, 0,
       @extracted_by, @now, @now
     )`,
  ).run({
    id,
    title: input.title,
    description: input.description,
    image_url: input.imageUrl,
    source_url: input.sourceUrl,
    source_name: input.sourceName,
    author: input.author,
    source_type: input.sourceType,
    servings: input.servings,
    servings_noun: input.servingsNoun,
    prep_minutes: input.prepMinutes,
    cook_minutes: input.cookMinutes,
    total_minutes: input.totalMinutes,
    ingredients: JSON.stringify(input.ingredients),
    steps: JSON.stringify(input.steps),
    notes: input.notes,
    tags: JSON.stringify(input.tags),
    nutrition: input.nutrition ? JSON.stringify(input.nutrition) : null,
    extracted_by: input.extractedBy,
    now,
  });

  return getRecipe(id)!;
}

const UPDATABLE: Record<string, string> = {
  title: "title",
  description: "description",
  imageUrl: "image_url",
  sourceUrl: "source_url",
  sourceName: "source_name",
  author: "author",
  servings: "servings",
  servingsNoun: "servings_noun",
  prepMinutes: "prep_minutes",
  cookMinutes: "cook_minutes",
  totalMinutes: "total_minutes",
  notes: "notes",
  favorite: "favorite",
};

const JSON_FIELDS: Record<string, string> = {
  ingredients: "ingredients",
  steps: "steps",
  tags: "tags",
  nutrition: "nutrition",
};

export function updateRecipe(id: string, patch: Partial<Recipe>): Recipe | null {
  const db = connect();
  if (!getRecipe(id)) return null;

  const sets: string[] = [];
  const params: Record<string, unknown> = { id };

  for (const [key, column] of Object.entries(UPDATABLE)) {
    if (!(key in patch)) continue;
    const value = (patch as Record<string, unknown>)[key];
    sets.push(`${column} = @${column}`);
    params[column] = typeof value === "boolean" ? (value ? 1 : 0) : value;
  }

  for (const [key, column] of Object.entries(JSON_FIELDS)) {
    if (!(key in patch)) continue;
    const value = (patch as Record<string, unknown>)[key];
    sets.push(`${column} = @${column}`);
    params[column] = value === null ? null : JSON.stringify(value);
  }

  if (sets.length) {
    sets.push("updated_at = @updated_at");
    params.updated_at = new Date().toISOString();
    db.prepare(`UPDATE recipes SET ${sets.join(", ")} WHERE id = @id`).run(params);
  }

  if (patch.folderIds) setRecipeFolders(id, patch.folderIds);

  return getRecipe(id);
}

export function deleteRecipe(id: string): boolean {
  const db = connect();
  return db.prepare("DELETE FROM recipes WHERE id = ?").run(id).changes > 0;
}

export function allTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const recipe of listRecipes()) {
    for (const tag of recipe.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/* ------------------------------------------------------------------ folders */

export function listFolders(): Folder[] {
  const db = connect();
  return db
    .prepare<[], Folder & { recipe_count: number }>(
      `SELECT f.id, f.name, f.emoji, f.created_at AS createdAt,
              (SELECT COUNT(*) FROM folder_recipes fr WHERE fr.folder_id = f.id) AS recipe_count
       FROM folders f ORDER BY f.name COLLATE NOCASE ASC`,
    )
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      createdAt: row.createdAt,
      recipeCount: row.recipe_count,
    }));
}

export function getFolder(id: string): Folder | null {
  return listFolders().find((f) => f.id === id) ?? null;
}

export function createFolder(name: string, emoji = "📁"): Folder {
  const db = connect();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO folders (id, name, emoji, created_at) VALUES (?, ?, ?, ?)",
  ).run(id, name.trim(), emoji, new Date().toISOString());
  return getFolder(id)!;
}

export function updateFolder(
  id: string,
  patch: { name?: string; emoji?: string },
): Folder | null {
  const db = connect();
  if (patch.name !== undefined) {
    db.prepare("UPDATE folders SET name = ? WHERE id = ?").run(patch.name.trim(), id);
  }
  if (patch.emoji !== undefined) {
    db.prepare("UPDATE folders SET emoji = ? WHERE id = ?").run(patch.emoji, id);
  }
  return getFolder(id);
}

export function deleteFolder(id: string): boolean {
  const db = connect();
  return db.prepare("DELETE FROM folders WHERE id = ?").run(id).changes > 0;
}

export function setRecipeFolders(recipeId: string, folderIds: string[]): void {
  const db = connect();
  const now = new Date().toISOString();
  const replace = db.transaction((ids: string[]) => {
    db.prepare("DELETE FROM folder_recipes WHERE recipe_id = ?").run(recipeId);
    const insert = db.prepare(
      "INSERT OR IGNORE INTO folder_recipes (folder_id, recipe_id, added_at) VALUES (?, ?, ?)",
    );
    for (const folderId of ids) insert.run(folderId, recipeId, now);
  });
  replace(folderIds);
}

/* ------------------------------------------------------------ grocery list */

type GroceryRow = {
  id: string;
  text: string;
  quantity: number | null;
  unit: string | null;
  item: string;
  aisle: string;
  checked: number;
  recipe_id: string | null;
  recipe_title: string | null;
  created_at: string;
};

function toGroceryItem(row: GroceryRow): GroceryItem {
  return {
    id: row.id,
    text: row.text,
    quantity: row.quantity,
    unit: row.unit,
    item: row.item,
    aisle: row.aisle,
    checked: row.checked === 1,
    recipeId: row.recipe_id,
    recipeTitle: row.recipe_title,
    createdAt: row.created_at,
  };
}

export function listGroceryItems(): GroceryItem[] {
  const db = connect();
  return db
    .prepare<[], GroceryRow>("SELECT * FROM grocery_items")
    .all()
    .map(toGroceryItem)
    .sort(
      (a, b) =>
        Number(a.checked) - Number(b.checked) ||
        aisleOrder(a.aisle) - aisleOrder(b.aisle) ||
        a.item.localeCompare(b.item),
    );
}

function insertGroceryItem(input: {
  text: string;
  quantity: number | null;
  unit: string | null;
  item: string;
  recipeId?: string | null;
  recipeTitle?: string | null;
}): GroceryItem {
  const db = connect();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO grocery_items
       (id, text, quantity, unit, item, aisle, checked, recipe_id, recipe_title, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
  ).run(
    id,
    input.text,
    input.quantity,
    input.unit,
    input.item,
    aisleFor(input.item),
    input.recipeId ?? null,
    input.recipeTitle ?? null,
    new Date().toISOString(),
  );
  return toGroceryItem(
    db.prepare<[string], GroceryRow>("SELECT * FROM grocery_items WHERE id = ?").get(id)!,
  );
}

export function addGroceryLine(text: string): GroceryItem {
  const ingredient = parseIngredientLine(text);
  return insertGroceryItem({
    text: text.trim(),
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    item: ingredient.item,
  });
}

/**
 * Adds a recipe's ingredients, merging with anything already on the list that
 * shares an item and unit — two recipes calling for butter give you one line.
 */
export function addRecipeToGroceryList(
  recipe: Recipe,
  factor = 1,
): { added: number; merged: number } {
  const db = connect();
  const existing = listGroceryItems();
  let added = 0;
  let merged = 0;

  const run = db.transaction(() => {
    for (const ingredient of recipe.ingredients) {
      const scaled =
        ingredient.quantity === null ? null : ingredient.quantity * factor;
      const key = ingredient.item.trim().toLowerCase();

      const match = existing.find(
        (candidate) =>
          !candidate.checked &&
          candidate.item.trim().toLowerCase() === key &&
          candidate.unit === ingredient.unit,
      );

      if (match && scaled !== null && match.quantity !== null) {
        const total = match.quantity + scaled;
        const text = formatIngredient(
          { ...ingredient, quantity: total },
          1,
        );
        db.prepare(
          "UPDATE grocery_items SET quantity = ?, text = ? WHERE id = ?",
        ).run(total, text, match.id);
        match.quantity = total;
        merged += 1;
        continue;
      }

      if (match && scaled === null && match.quantity === null) {
        merged += 1;
        continue;
      }

      const item = insertGroceryItem({
        text: formatIngredient({ ...ingredient, quantity: scaled }, 1),
        quantity: scaled,
        unit: ingredient.unit,
        item: ingredient.item,
        recipeId: recipe.id,
        recipeTitle: recipe.title,
      });
      existing.push(item);
      added += 1;
    }
  });

  run();
  return { added, merged };
}

export function setGroceryChecked(id: string, checked: boolean): GroceryItem | null {
  const db = connect();
  db.prepare("UPDATE grocery_items SET checked = ? WHERE id = ?").run(
    checked ? 1 : 0,
    id,
  );
  const row = db
    .prepare<[string], GroceryRow>("SELECT * FROM grocery_items WHERE id = ?")
    .get(id);
  return row ? toGroceryItem(row) : null;
}

export function deleteGroceryItem(id: string): boolean {
  const db = connect();
  return db.prepare("DELETE FROM grocery_items WHERE id = ?").run(id).changes > 0;
}

export function clearGroceryItems(onlyChecked: boolean): number {
  const db = connect();
  const sql = onlyChecked
    ? "DELETE FROM grocery_items WHERE checked = 1"
    : "DELETE FROM grocery_items";
  return db.prepare(sql).run().changes;
}
