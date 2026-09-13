"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Folder, Recipe } from "@/lib/types";
import { deleteFolder, setRecipeFolders, updateFolder } from "@/lib/store";
import { RecipeRow } from "./RecipeCard";
import { EmptyState } from "./EmptyState";

export function FolderDetail({
  folder,
  recipes,
  available,
  onChanged,
}: {
  folder: Folder;
  recipes: Recipe[];
  available: Recipe[];
  /** Re-reads the folder after a change, so the screen stays in step. */
  onChanged: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(folder.name);

  const cover = recipes.find((recipe) => recipe.imageUrl)?.imageUrl ?? null;

  async function addRecipe(recipe: Recipe) {
    await setRecipeFolders(recipe.id, [...(recipe.folderIds ?? []), folder.id]);
    await onChanged();
  }

  async function removeRecipe(recipe: Recipe) {
    await setRecipeFolders(
      recipe.id,
      (recipe.folderIds ?? []).filter((id) => id !== folder.id),
    );
    await onChanged();
  }

  async function rename() {
    if (!name.trim()) return;
    await updateFolder(folder.id, { name });
    setRenaming(false);
    await onChanged();
  }

  async function remove() {
    if (!confirm(`Delete the folder “${folder.name}”? The recipes inside stay in your box.`)) {
      return;
    }
    await deleteFolder(folder.id);
    router.push("/folders");
  }

  return (
    <div className="-mt-4">
      <div className="relative">
        <div className="aspect-[16/10] w-full overflow-hidden rounded-b-3xl bg-subtle sm:rounded-3xl">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-5xl opacity-30" aria-hidden>
              {folder.emoji}
            </span>
          )}
        </div>

        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          <Link
            href="/folders"
            aria-label="Back to folders"
            className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-float"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m15 5-7 7 7 7" />
            </svg>
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Folder actions"
              className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-float"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
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
                <div className="absolute top-12 right-0 z-20 w-48 overflow-hidden rounded-2xl bg-card py-1 shadow-float">
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(true);
                      setMenuOpen(false);
                    }}
                    className="block w-full px-4 py-2.5 text-left text-[14.5px] font-medium"
                  >
                    Rename folder
                  </button>
                  <button
                    type="button"
                    onClick={remove}
                    className="block w-full px-4 py-2.5 text-left text-[14.5px] font-medium text-accent"
                  >
                    Delete folder
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-[1] -mt-8 rounded-3xl bg-card p-5 shadow-float">
        {renaming ? (
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && rename()}
              autoFocus
              aria-label="Folder name"
              className="min-w-0 flex-1 rounded-xl bg-subtle px-3 py-2.5 text-[16px] font-bold outline-none"
            />
            <button
              type="button"
              onClick={rename}
              className="rounded-xl px-4 text-[14px] font-bold text-white"
              style={{ background: "var(--accent)" }}
            >
              Save
            </button>
          </div>
        ) : (
          <h1 className="font-display text-[24px] leading-tight font-extrabold">
            <span className="mr-2" aria-hidden>
              {folder.emoji}
            </span>
            {folder.name}
          </h1>
        )}
        <p className="mt-1 text-[13.5px] text-muted">
          {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setPicking(true)}
        disabled={available.length === 0}
        className="pressable mt-4 flex w-full items-center gap-3 disabled:opacity-40"
      >
        <span
          className="flex h-14 w-14 items-center justify-center rounded-xl text-xl"
          style={{ background: "var(--subtle)", color: "var(--muted)" }}
          aria-hidden
        >
          +
        </span>
        <span className="font-display text-[15px] font-bold">Add to this folder</span>
      </button>

      <div className="mt-2">
        {recipes.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              emoji="📂"
              title="This folder is empty"
              body="Add recipes you already saved, or tick this folder when you import something new."
            />
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
            {recipes.map((recipe) => (
              <li key={recipe.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <RecipeRow recipe={recipe} />
                </div>
                <button
                  type="button"
                  onClick={() => removeRecipe(recipe)}
                  aria-label={`Remove ${recipe.title} from this folder`}
                  className="pressable shrink-0 px-2 text-muted"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {picking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setPicking(false)}
            className="absolute inset-0 bg-black/35"
          />
          <div className="relative max-h-[75vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 pb-8 shadow-float">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--line)" }} />
            <h2 className="font-display text-[19px] font-extrabold">Add to {folder.name}</h2>
            <ul className="mt-2 divide-y" style={{ borderColor: "var(--line)" }}>
              {available.map((recipe) => (
                <li key={recipe.id}>
                  <button
                    type="button"
                    onClick={() => {
                      void addRecipe(recipe);
                      setPicking(false);
                    }}
                    className="flex w-full items-center gap-3 py-3 text-left"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-subtle">
                      {recipe.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={recipe.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center opacity-30" aria-hidden>
                          🍲
                        </span>
                      )}
                    </div>
                    <span className="font-display min-w-0 flex-1 truncate text-[15px] font-bold">
                      {recipe.title}
                    </span>
                    <span className="text-accent" aria-hidden>
                      +
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
