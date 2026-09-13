"use client";

import type {
  Folder,
  GroceryItem,
  Recipe,
  RecipeDraft,
  RecipeQuery,
} from "./types";
import { aisleFor, aisleOrder } from "./aisle";
import { formatIngredient, parseIngredientLine } from "./quantity";

/**
 * On-device storage. Everything lives in IndexedDB inside the app's own
 * sandbox — there is no server, no account, and nothing leaves the phone
 * except the page fetches an import makes on your behalf.
 *
 * IndexedDB rather than a native SQLite plugin: the WebView supports it
 * everywhere, it needs no native module to build, and a personal recipe box is
 * small enough that filtering in JavaScript is instant.
 */

const DB_NAME = "ladle";
const DB_VERSION = 1;

const RECIPES = "recipes";
const FOLDERS = "folders";
const GROCERY = "grocery";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECIPES)) {
        db.createObjectStore(RECIPES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(FOLDERS)) {
        db.createObjectStore(FOLDERS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(GROCERY)) {
        db.createObjectStore(GROCERY, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the database."));
  });

  return dbPromise;
}

async function readAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function readOne<T>(store: string, id: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, "readonly").objectStore(store).get(id);
    request.onsuccess = () => resolve((request.result as T) ?? null);
    request.onerror = () => reject(request.error);
  });
}

/** Applies a set of writes in one transaction, so a failure leaves nothing half-done. */
async function write(
  store: string,
  apply: (objectStore: IDBObjectStore) => void,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, "readwrite");
    apply(transaction.objectStore(store));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function newId(): string {
  // randomUUID needs a secure context; the WebView is one, but a plain-HTTP
  // dev server is not, so fall back rather than throwing.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ recipes */

function matches(recipe: Recipe, query: RecipeQuery): boolean {
  if (query.folderId && !recipe.folderIds?.includes(query.folderId)) return false;
  if (query.favoritesOnly && !recipe.favorite) return false;
  if (query.tag && !recipe.tags.includes(query.tag.toLowerCase())) return false;

  const search = query.search?.trim().toLowerCase();
  if (!search) return true;

  // Search titles, descriptions, tags, source and the ingredient list together,
  // so "the one with miso" finds a recipe whose title never mentions miso.
  const haystack = [
    recipe.title,
    recipe.description ?? "",
    recipe.sourceName ?? "",
    recipe.author ?? "",
    recipe.tags.join(" "),
    recipe.ingredients.map((i) => `${i.item} ${i.note ?? ""}`).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(search);
}

function sortRecipes(recipes: Recipe[], sort: RecipeQuery["sort"]): Recipe[] {
  const copy = [...recipes];
  if (sort === "title") {
    copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  } else if (sort === "time") {
    // Recipes with no stated time sort last rather than first.
    const minutes = (r: Recipe) => {
      const total = r.totalMinutes ?? (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
      return total > 0 ? total : Number.MAX_SAFE_INTEGER;
    };
    copy.sort((a, b) => minutes(a) - minutes(b));
  } else {
    copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return copy;
}

export async function listRecipes(query: RecipeQuery = {}): Promise<Recipe[]> {
  const all = await readAll<Recipe>(RECIPES);
  return sortRecipes(
    all.filter((recipe) => matches(recipe, query)),
    query.sort,
  );
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  return readOne<Recipe>(RECIPES, id);
}

export async function createRecipe(input: RecipeDraft): Promise<Recipe> {
  const now = new Date().toISOString();
  const recipe: Recipe = {
    id: newId(),
    title: input.title.trim() || "Untitled recipe",
    description: input.description,
    imageUrl: input.imageUrl,
    sourceUrl: input.sourceUrl,
    sourceName: input.sourceName,
    author: input.author,
    sourceType: input.sourceType,
    servings: input.servings,
    servingsNoun: input.servingsNoun || "servings",
    prepMinutes: input.prepMinutes,
    cookMinutes: input.cookMinutes,
    totalMinutes: input.totalMinutes,
    ingredients: input.ingredients ?? [],
    steps: input.steps ?? [],
    notes: input.notes,
    tags: input.tags ?? [],
    nutrition: input.nutrition,
    favorite: false,
    extractedBy: input.extractedBy,
    createdAt: now,
    updatedAt: now,
    folderIds: input.folderIds ?? [],
  };

  await write(RECIPES, (store) => store.put(recipe));
  return recipe;
}

export async function updateRecipe(
  id: string,
  patch: Partial<Recipe>,
): Promise<Recipe | null> {
  const existing = await getRecipe(id);
  if (!existing) return null;

  const updated: Recipe = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await write(RECIPES, (store) => store.put(updated));
  return updated;
}

export async function deleteRecipe(id: string): Promise<void> {
  await write(RECIPES, (store) => store.delete(id));
}

export async function allTags(): Promise<{ tag: string; count: number }[]> {
  const recipes = await readAll<Recipe>(RECIPES);
  const counts = new Map<string, number>();
  for (const recipe of recipes) {
    for (const tag of recipe.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/* ------------------------------------------------------------------ folders */

export async function listFolders(): Promise<Folder[]> {
  const [folders, recipes] = await Promise.all([
    readAll<Folder>(FOLDERS),
    readAll<Recipe>(RECIPES),
  ]);

  return folders
    .map((folder) => ({
      ...folder,
      recipeCount: recipes.filter((recipe) => recipe.folderIds?.includes(folder.id)).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export async function getFolder(id: string): Promise<Folder | null> {
  return (await listFolders()).find((folder) => folder.id === id) ?? null;
}

export async function createFolder(name: string, emoji = "📁"): Promise<Folder> {
  const folder: Folder = {
    id: newId(),
    name: name.trim() || "Untitled folder",
    emoji,
    createdAt: new Date().toISOString(),
  };
  await write(FOLDERS, (store) => store.put(folder));
  return { ...folder, recipeCount: 0 };
}

export async function updateFolder(
  id: string,
  patch: { name?: string; emoji?: string },
): Promise<Folder | null> {
  const existing = await readOne<Folder>(FOLDERS, id);
  if (!existing) return null;

  const updated: Folder = {
    ...existing,
    ...(patch.name !== undefined ? { name: patch.name.trim() || existing.name } : {}),
    ...(patch.emoji !== undefined ? { emoji: patch.emoji } : {}),
  };
  await write(FOLDERS, (store) => store.put(updated));
  return getFolder(id);
}

/** Deleting a folder never deletes the recipes inside it. */
export async function deleteFolder(id: string): Promise<void> {
  await write(FOLDERS, (store) => store.delete(id));

  const recipes = await readAll<Recipe>(RECIPES);
  const affected = recipes.filter((recipe) => recipe.folderIds?.includes(id));
  if (!affected.length) return;

  await write(RECIPES, (store) => {
    for (const recipe of affected) {
      store.put({ ...recipe, folderIds: recipe.folderIds!.filter((f) => f !== id) });
    }
  });
}

export async function setRecipeFolders(recipeId: string, folderIds: string[]): Promise<void> {
  const recipe = await getRecipe(recipeId);
  if (!recipe) return;
  await write(RECIPES, (store) => store.put({ ...recipe, folderIds }));
}

/* ------------------------------------------------------------- grocery list */

/**
 * The key two grocery lines must share to be merged. Folds case, trims, and
 * knocks a simple plural off the end so "2 lemons" lands on "1 lemon" rather
 * than sitting next to it on the list.
 */
function groceryKey(item: string): string {
  const text = item.trim().toLowerCase().replace(/\s+/g, " ");
  const last = text.split(" ").pop() ?? "";

  // "glass" and "couscous" are not plurals; "tomatoes" and "lemons" are.
  if (/(?:ss|us|is)$/.test(last)) return text;
  if (/ies$/.test(last)) return text.replace(/ies$/, "y");
  if (/(?:ch|sh|x|z|s)es$/.test(last)) return text.replace(/es$/, "");
  if (/[^s]s$/.test(last)) return text.replace(/s$/, "");
  return text;
}

export async function listGroceryItems(): Promise<GroceryItem[]> {
  const items = await readAll<GroceryItem>(GROCERY);
  return items.sort(
    (a, b) =>
      Number(a.checked) - Number(b.checked) ||
      aisleOrder(a.aisle) - aisleOrder(b.aisle) ||
      a.item.localeCompare(b.item),
  );
}

export async function addGroceryLine(text: string): Promise<GroceryItem> {
  const ingredient = parseIngredientLine(text);
  const key = groceryKey(ingredient.item);
  const existing = await listGroceryItems();

  // Typing something already on the list tops up that line instead of
  // creating a duplicate.
  const match = existing.find(
    (candidate) =>
      !candidate.checked &&
      groceryKey(candidate.item) === key &&
      candidate.unit === ingredient.unit,
  );

  if (match && match.quantity !== null && ingredient.quantity !== null) {
    const total = match.quantity + ingredient.quantity;
    const merged: GroceryItem = {
      ...match,
      quantity: total,
      text: formatIngredient({ ...ingredient, quantity: total }),
    };
    await write(GROCERY, (store) => store.put(merged));
    return merged;
  }

  const item: GroceryItem = {
    id: newId(),
    text: text.trim(),
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    item: ingredient.item,
    aisle: aisleFor(ingredient.item),
    checked: false,
    recipeId: null,
    recipeTitle: null,
    createdAt: new Date().toISOString(),
  };
  await write(GROCERY, (store) => store.put(item));
  return item;
}

/**
 * Adds a recipe's ingredients, merging with anything already on the list that
 * shares an item and unit — two recipes calling for butter give you one line.
 */
export async function addRecipeToGroceryList(
  recipe: Recipe,
  factor = 1,
): Promise<{ added: number; merged: number }> {
  const existing = await listGroceryItems();
  const now = new Date().toISOString();
  const writes: GroceryItem[] = [];
  let added = 0;
  let merged = 0;

  for (const ingredient of recipe.ingredients) {
    const scaled = ingredient.quantity === null ? null : ingredient.quantity * factor;
    const key = groceryKey(ingredient.item);

    const match = existing.find(
      (candidate) =>
        !candidate.checked &&
        groceryKey(candidate.item) === key &&
        candidate.unit === ingredient.unit,
    );

    if (match && scaled !== null && match.quantity !== null) {
      const total = match.quantity + scaled;
      match.quantity = total;
      match.text = formatIngredient({ ...ingredient, quantity: total });
      writes.push(match);
      merged += 1;
      continue;
    }

    if (match && scaled === null && match.quantity === null) {
      merged += 1;
      continue;
    }

    const item: GroceryItem = {
      id: newId(),
      text: formatIngredient({ ...ingredient, quantity: scaled }),
      quantity: scaled,
      unit: ingredient.unit,
      item: ingredient.item,
      aisle: aisleFor(ingredient.item),
      checked: false,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      createdAt: now,
    };
    existing.push(item);
    writes.push(item);
    added += 1;
  }

  if (writes.length) {
    await write(GROCERY, (store) => {
      for (const item of writes) store.put(item);
    });
  }

  return { added, merged };
}

export async function setGroceryChecked(
  id: string,
  checked: boolean,
): Promise<GroceryItem | null> {
  const item = await readOne<GroceryItem>(GROCERY, id);
  if (!item) return null;
  const updated = { ...item, checked };
  await write(GROCERY, (store) => store.put(updated));
  return updated;
}

export async function deleteGroceryItem(id: string): Promise<void> {
  await write(GROCERY, (store) => store.delete(id));
}

export async function clearGroceryItems(onlyChecked: boolean): Promise<number> {
  const items = await readAll<GroceryItem>(GROCERY);
  const doomed = onlyChecked ? items.filter((item) => item.checked) : items;
  if (!doomed.length) return 0;

  await write(GROCERY, (store) => {
    for (const item of doomed) store.delete(item.id);
  });
  return doomed.length;
}

/* ----------------------------------------------------------------- transfer */

/** Everything, as one JSON blob — the backup and hand-off format. */
export async function exportAll(): Promise<string> {
  const [recipes, folders, grocery] = await Promise.all([
    readAll<Recipe>(RECIPES),
    readAll<Folder>(FOLDERS),
    readAll<GroceryItem>(GROCERY),
  ]);
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), recipes, folders, grocery },
    null,
    2,
  );
}

/** Merges a backup in, keeping anything already saved. Returns what it added. */
export async function importAll(json: string): Promise<{ recipes: number; folders: number }> {
  const parsed = JSON.parse(json) as {
    recipes?: Recipe[];
    folders?: Folder[];
    grocery?: GroceryItem[];
  };

  const [haveRecipes, haveFolders] = await Promise.all([
    readAll<Recipe>(RECIPES),
    readAll<Folder>(FOLDERS),
  ]);
  const recipeIds = new Set(haveRecipes.map((r) => r.id));
  const folderIds = new Set(haveFolders.map((f) => f.id));

  const newRecipes = (parsed.recipes ?? []).filter((r) => r?.id && !recipeIds.has(r.id));
  const newFolders = (parsed.folders ?? []).filter((f) => f?.id && !folderIds.has(f.id));

  if (newFolders.length) {
    await write(FOLDERS, (store) => {
      for (const folder of newFolders) store.put(folder);
    });
  }
  if (newRecipes.length) {
    await write(RECIPES, (store) => {
      for (const recipe of newRecipes) store.put(recipe);
    });
  }

  return { recipes: newRecipes.length, folders: newFolders.length };
}
