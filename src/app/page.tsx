import Link from "next/link";
import { allTags, listFolders, listRecipes } from "@/lib/db";
import { RecipeCard } from "@/components/RecipeCard";
import { FolderTile } from "@/components/FolderTile";
import { EmptyState } from "@/components/EmptyState";
import { PastePrompt } from "@/components/PastePrompt";
import { SearchField } from "@/components/SearchField";
import { Wordmark } from "@/components/Wordmark";
import { Fab } from "@/components/Fab";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  tag?: string;
  favorites?: string;
  sort?: string;
}>;

export default async function RecipeBoxPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const favoritesOnly = params.favorites === "1";
  const sort = (params.sort as "recent" | "title" | "time") ?? "recent";
  const filtering = Boolean(params.q || params.tag || favoritesOnly);

  const recipes = listRecipes({
    search: params.q,
    tag: params.tag,
    favoritesOnly,
    sort,
  });

  const everything = listRecipes();
  const folders = listFolders();
  const tags = allTags();

  /** A folder's cover is the newest recipe inside it. */
  const coverFor = (folderId: string) =>
    everything.find((recipe) => recipe.folderIds?.includes(folderId));

  return (
    <main>
      <header className="mb-4 flex items-center justify-between">
        <Wordmark />
        <div className="flex items-center gap-1">
          <Link
            href="/folders"
            aria-label="Folders"
            className="pressable flex h-10 w-10 items-center justify-center rounded-full"
          >
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
          </Link>
          <Link
            href="/grocery"
            aria-label="Grocery list"
            className="pressable relative flex h-10 w-10 items-center justify-center rounded-full"
          >
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 6h13M8 12h13M8 18h13" />
              <path d="m3.4 6 .9 1L6 5M3.4 12l.9 1L6 11M3.4 18l.9 1L6 17" />
            </svg>
          </Link>
        </div>
      </header>

      <SearchField
        defaultValue={params.q ?? ""}
        hidden={{
          tag: params.tag,
          favorites: favoritesOnly ? "1" : undefined,
          sort: params.sort,
        }}
      />

      <div className="mt-3">
        <PastePrompt />
      </div>

      {(tags.length > 0 || everything.length > 0) && (
        <div className="scroll-row mb-6 flex gap-2 overflow-x-auto text-[13.5px]">
          <Chip href={buildHref(params, { favorites: null, tag: null, q: null })} active={!filtering}>
            All
          </Chip>
          <Chip
            href={buildHref(params, { favorites: favoritesOnly ? null : "1" })}
            active={favoritesOnly}
          >
            ★ Favourites
          </Chip>
          {tags.slice(0, 12).map(({ tag, count }) => (
            <Chip
              key={tag}
              href={buildHref(params, { tag: params.tag === tag ? null : tag })}
              active={params.tag === tag}
            >
              {tag} <span className="opacity-55">{count}</span>
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
              <span className="ml-2 text-[15px] font-semibold text-muted">
                {recipes.length}
              </span>
            )}
          </h2>
          {recipes.length > 1 && (
            <div className="flex gap-3 text-[13px] text-muted">
              <SortLink params={params} value="recent" current={sort}>
                Recent
              </SortLink>
              <SortLink params={params} value="title" current={sort}>
                A–Z
              </SortLink>
              <SortLink params={params} value="time" current={sort}>
                Quickest
              </SortLink>
            </div>
          )}
        </div>

        {recipes.length === 0 ? (
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
              actionHref="/"
              actionLabel="Clear filters"
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
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-3.5 py-1.5 font-medium whitespace-nowrap ${
        active ? "bg-ink text-[var(--card)]" : "bg-subtle text-muted"
      }`}
      style={active ? { background: "var(--ink)", color: "var(--card)" } : undefined}
    >
      {children}
    </Link>
  );
}

function SortLink({
  params,
  value,
  current,
  children,
}: {
  params: Record<string, string | undefined>;
  value: string;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={buildHref(params, { sort: value })}
      className={current === value ? "font-bold text-accent" : ""}
    >
      {children}
    </Link>
  );
}

/** Keeps the current filters while changing one of them. */
function buildHref(
  params: Record<string, string | undefined>,
  changes: Record<string, string | null>,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) next.set(key, value);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `/?${query}` : "/";
}
