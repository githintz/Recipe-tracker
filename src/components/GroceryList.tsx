"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { GroceryItem, Recipe } from "@/lib/types";
import { AISLES, aisleOrder } from "@/lib/aisle";
import { formatQuantity, formatUnit } from "@/lib/quantity";
import {
  addGroceryLine,
  clearGroceryItems,
  deleteGroceryItem,
  setGroceryChecked,
} from "@/lib/store";
import { RecipeChip } from "./RecipeCard";
import { EmptyState } from "./EmptyState";

type SortMode = "aisle" | "added" | "recipe";

const SORT_LABEL: Record<SortMode, string> = {
  aisle: "By aisle",
  added: "By date added",
  recipe: "By recipe",
};

export function GroceryList({
  initialItems,
  recipes,
}: {
  initialItems: GroceryItem[];
  recipes: Recipe[];
}) {
  const [items, setItems] = useState(initialItems);
  const [sort, setSort] = useState<SortMode>("aisle");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showRecipes, setShowRecipes] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const remaining = items.filter((item) => !item.checked).length;

  const groups = useMemo(() => groupItems(items, sort), [items, sort]);

  async function toggle(item: GroceryItem) {
    const next = !item.checked;
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, checked: next } : entry)),
    );
    await setGroceryChecked(item.id, next);
  }

  async function remove(item: GroceryItem) {
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    await deleteGroceryItem(item.id);
  }

  async function add() {
    const text = draft.trim();
    if (!text) return;
    setAdding(true);
    const saved = await addGroceryLine(text);
    // An added line may merge into one already there, so replace by id rather
    // than always appending.
    setItems((current) => {
      const existing = current.findIndex((entry) => entry.id === saved.id);
      if (existing === -1) return [...current, saved];
      const next = [...current];
      next[existing] = saved;
      return next;
    });
    setDraft("");
    setAdding(false);
  }

  async function clear(scope: "checked" | "all") {
    if (scope === "all" && !confirm("Clear the whole list?")) return;
    setItems((current) => (scope === "all" ? [] : current.filter((item) => !item.checked)));
    await clearGroceryItems(scope === "checked");
    setMenuOpen(false);
  }

  async function copyList() {
    const text = groups
      .map(({ name, entries }) =>
        [name, ...entries.filter((i) => !i.checked).map((i) => `- ${i.text}`)].join("\n"),
      )
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Nothing to fall back to here; the list is still on screen.
    }
    setMenuOpen(false);
  }

  return (
    <div>
      <header className="mb-3 flex items-center justify-between">
        <h1 className="font-display text-[27px] font-extrabold">Grocery list</h1>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="List actions"
            className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-subtle"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="1.9" />
              <circle cx="12" cy="12" r="1.9" />
              <circle cx="19" cy="12" r="1.9" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute top-11 right-0 z-20 w-52 overflow-hidden rounded-2xl bg-card py-1 shadow-float">
                <button type="button" onClick={copyList} className="block w-full px-4 py-2.5 text-left text-[14.5px] font-medium">
                  Copy list
                </button>
                <button type="button" onClick={() => clear("checked")} className="block w-full px-4 py-2.5 text-left text-[14.5px] font-medium">
                  Clear ticked items
                </button>
                <button type="button" onClick={() => clear("all")} className="block w-full px-4 py-2.5 text-left text-[14.5px] font-medium text-accent">
                  Clear everything
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            setSort((current) =>
              current === "aisle" ? "added" : current === "added" ? "recipe" : "aisle",
            )
          }
          className="flex items-center gap-1.5 text-[14px] font-bold"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 3v18M8 3 5 6.5M8 3l3 3.5M16 21V3M16 21l3-3.5M16 21l-3-3.5" />
          </svg>
          {SORT_LABEL[sort]}
        </button>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="text-[14px] font-bold text-accent"
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      {recipes.length > 0 && (
        <section className="mb-5">
          <button
            type="button"
            onClick={() => setShowRecipes((value) => !value)}
            className="mb-2.5 flex items-center gap-1.5"
          >
            <h2 className="section-title">Recipes</h2>
            <span className="text-muted" aria-hidden>
              {showRecipes ? "⌄" : "›"}
            </span>
          </button>
          {showRecipes && (
            <div className="scroll-row -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
              {recipes.map((recipe) => (
                <RecipeChip key={recipe.id} recipe={recipe} />
              ))}
              <Link
                href="/"
                className="pressable flex w-[104px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-subtle text-[12.5px] font-bold text-muted"
                style={{ aspectRatio: "1 / 1" }}
              >
                <span className="text-xl" aria-hidden>
                  +
                </span>
                Add a recipe
              </Link>
            </div>
          )}
        </section>
      )}

      {items.length === 0 ? (
        <EmptyState
          emoji="🧺"
          title="Nothing on the list"
          body="Open a recipe and add its ingredients, or type something in below. Repeats get merged into one line."
          actionHref="/"
          actionLabel="Browse recipes"
        />
      ) : (
        <div className="space-y-3">
          {groups.map(({ name, entries }) => {
            const isCollapsed = collapsed.has(name);
            return (
              <section key={name} className="overflow-hidden rounded-2xl bg-card p-4 shadow-card">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(name)) next.delete(name);
                      else next.add(name);
                      return next;
                    })
                  }
                  className="flex w-full items-center justify-between"
                >
                  <h2 className="font-display text-[17px] font-extrabold">
                    {name} <span className="font-bold text-muted">({entries.length})</span>
                  </h2>
                  <span className="text-muted" aria-hidden>
                    {isCollapsed ? "›" : "⌄"}
                  </span>
                </button>

                {!isCollapsed && (
                  <ul className="mt-1">
                    {entries.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 border-t border-line first:border-t-0">
                        <button
                          type="button"
                          onClick={() => toggle(item)}
                          aria-pressed={item.checked}
                          className="flex flex-1 items-center gap-3 py-3 text-left"
                        >
                          <span
                            aria-hidden
                            className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[6px] border-2 text-[11px]"
                            style={{
                              borderColor: item.checked ? "var(--ink)" : "var(--line)",
                              background: item.checked ? "var(--ink)" : "transparent",
                              color: "var(--card)",
                            }}
                          >
                            {item.checked ? "✓" : ""}
                          </span>
                          <span className={`text-[15px] ${item.checked ? "text-muted line-through" : ""}`}>
                            <ItemText item={item} />
                          </span>
                        </button>

                        {editing && (
                          <button
                            type="button"
                            onClick={() => remove(item)}
                            aria-label={`Remove ${item.item}`}
                            className="pressable px-1 text-accent"
                          >
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                              <path d="M6 6l12 12M18 6 6 18" />
                            </svg>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          <p className="px-1 pt-1 pb-20 text-[13px] text-muted">
            {remaining === 0
              ? "Everything ticked off."
              : `${remaining} left to buy · ${items.length - remaining} in the trolley`}
          </p>
        </div>
      )}

      <div className="no-print fixed inset-x-0 bottom-20 z-30 px-4">
        <div className="mx-auto flex max-w-3xl gap-2 rounded-full bg-card p-1.5 shadow-float">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Add an item…"
            aria-label="Add a grocery item"
            className="min-w-0 flex-1 rounded-full bg-transparent px-4 py-2.5 text-[15px] outline-none"
          />
          <button
            type="button"
            onClick={add}
            disabled={adding || !draft.trim()}
            aria-label="Add item"
            className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemText({ item }: { item: GroceryItem }) {
  // The amount reads as the bold part, the food as plain text. Rebuild the
  // amount from the stored numbers rather than subtracting strings — "lemon"
  // is a substring of "3 lemons", and cutting it out leaves nonsense.
  const amount = [formatQuantity(item.quantity), formatUnit(item.unit, item.quantity)]
    .filter(Boolean)
    .join(" ");

  const rest = amount && item.text.startsWith(amount)
    ? item.text.slice(amount.length).trim()
    : item.item;

  return (
    <>
      {amount && <strong className="font-bold">{amount} </strong>}
      {rest}
    </>
  );
}

function groupItems(
  items: GroceryItem[],
  sort: SortMode,
): { name: string; entries: GroceryItem[] }[] {
  const buckets = new Map<string, GroceryItem[]>();

  for (const item of items) {
    const key =
      sort === "aisle"
        ? item.aisle
        : sort === "recipe"
          ? (item.recipeTitle ?? "Added by hand")
          : item.checked
            ? "Ticked off"
            : "To buy";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const entries = [...buckets.entries()].map(([name, list]) => ({
    name,
    entries: list.sort(
      (a, b) => Number(a.checked) - Number(b.checked) || a.item.localeCompare(b.item),
    ),
  }));

  if (sort === "aisle") {
    entries.sort((a, b) => aisleOrder(a.name) - aisleOrder(b.name));
  } else if (sort === "added") {
    // "To buy" always sits above "Ticked off".
    entries.sort((a, b) => (a.name === "To buy" ? -1 : b.name === "To buy" ? 1 : 0));
  } else {
    entries.sort((a, b) => a.name.localeCompare(b.name));
  }

  return entries;
}

export { AISLES };
