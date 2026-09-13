"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Folder, Recipe } from "@/lib/types";
import { allTags, listFolders, listRecipes } from "@/lib/store";
import { RecipeCard } from "@/components/RecipeCard";
import { FolderTile } from "@/components/FolderTile";
import { EmptyState } from "@/components/EmptyState";
import { PastePrompt } from "@/components/PastePrompt";
import { Wordmark } from "@/components/Wordmark";
import { Fab } from "@/components/Fab";
import { Spinner } from "@/components/Spinner";

type Sort = "recent" | "title" | "time";

export default function RecipeBoxPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [everything, setEverything] = useState<Recipe[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("recent");

  const filtering = Boolean(search.trim() || tag || favoritesOnly);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [all, folderList, tagList] = await Promise.all([
        listRecipes(),
        listFolders(),
        allTags(),
      ]);
      if (cancelled) return;
      setEverything(all);
      setFolders(folderList);
      setTags(tagList);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-query whenever a filter changes. Searching a personal recipe box is
  // instant, so there's no need to debounce the store itself.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await listRecipes({
        search,
        tag: tag ?? undefined,
        favoritesOnly,
        sort,
      });
      if (!cancelled) setRecipes(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [search, tag, favoritesOnly, sort, everything]);

  const coverFor = (folderId: string) =>
    everything.find((recipe) => recipe.folderIds?.includes(folderId));

  return (
    <main>
      <header className="mb-4 flex items-center justify-between">
        <Wordmark />
        {/* Folders and the list already have tabs, so the header carries settings. */}
        <Link
          href="/settings"
          aria-label="Settings"
          className="pressable flex h-10 w-10 items-center justify-center rounded-full"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3.1" />
            <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
          </svg>
        </Link>
      </header>

      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes and ingredients"
          aria-label="Search recipes"
          className="w-full rounded-2xl py-3 pr-4 pl-10 text-[15px] outline-none placeholder:text-muted"
          style={{ background: "var(--subtle)" }}
        />
      </div>

      <div className="mt-3">
        <PastePrompt />
      </div>

      {everything.length > 0 && (
        <div className="scroll-row mb-6 flex gap-2 overflow-x-auto text-[13.5px]">
          <Chip
            active={!filtering}
            onClick={() => {
              setSearch("");
              setTag(null);
              setFavoritesOnly(false);
            }}
          >
            All
          </Chip>
          <Chip active={favoritesOnly} onClick={() => setFavoritesOnly((v) => !v)}>
            ★ Favourites
          </Chip>
          {tags.slice(0, 12).map(({ tag: name, count }) => (
            <Chip
              key={name}
              active={tag === name}
              onClick={() => setTag((current) => (current === name ? null : name))}
            >
              {name} <span className="opacity-55">{count}</span>
            </Chip>
          ))}
        </div>
      )}

      {folders.length > 0 && !filtering && (
        <section className="mb-7">
          <Link href="/folders" className="mb-3 flex items-center gap-1">
            <h2 className="section-title">Folders</h2>
            <Chevron />
          </Link>
          <div className="scroll-row -mx-4 flex gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
            {folders.map((folder) => (
              <FolderTile key={folder.id} folder={folder} cover={coverFor(folder.id)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="section-title">
            {filtering ? "Results" : "Recipes"}
            {recipes.length > 0 && (
              <span className="ml-2 text-[15px] font-semibold text-muted">{recipes.length}</span>
            )}
          </h2>
          {recipes.length > 1 && (
            <div className="flex gap-3 text-[13px] text-muted">
              {(["recent", "title", "time"] as Sort[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSort(value)}
                  className={sort === value ? "font-bold text-accent" : ""}
                >
                  {value === "recent" ? "Recent" : value === "title" ? "A–Z" : "Quickest"}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <Spinner label="Opening your recipe box…" />
        ) : recipes.length === 0 ? (
          everything.length === 0 ? (
            <EmptyState
              emoji="🥄"
              title="No recipes yet"
              body="Paste a link from Instagram, TikTok or any recipe site. It lands here as something you can actually cook from — no ads, no life story."
              actionHref="/import"
              actionLabel="Add your first recipe"
            />
          ) : (
            <EmptyState
              emoji="🔍"
              title="Nothing matched"
              body="Try a different search, or clear the filters to see everything you've saved."
            />
          )
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </section>

      <Fab href="/import" label="Add a recipe" />
    </main>
  );
}

function Chevron() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full px-3.5 py-1.5 font-medium whitespace-nowrap"
      style={
        active
          ? { background: "var(--ink)", color: "var(--card)" }
          : { background: "var(--subtle)", color: "var(--muted)" }
      }
    >
      {children}
    </button>
  );
}
