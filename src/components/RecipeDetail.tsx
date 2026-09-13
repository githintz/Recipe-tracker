"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Recipe } from "@/lib/types";
import { Avatar } from "./Avatar";
import { formatMinutesPlain } from "@/lib/format";
import { renderIngredient, isConvertible, UNIT_SYSTEM_LABEL, type UnitSystem } from "@/lib/units";
import { recipeToPlainText } from "@/lib/serialize";

const SCALES = [0.5, 1, 1.5, 2, 3, 4];

export function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const [tab, setTab] = useState<"ingredients" | "directions">("ingredients");
  const [factor, setFactor] = useState(1);
  const [system, setSystem] = useState<UnitSystem>("original");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [favorite, setFavorite] = useState(recipe.favorite);
  const [toast, setToast] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const credit = recipe.author ?? recipe.sourceName ?? "Your recipe";
  const convertible = useMemo(() => isConvertible(recipe.ingredients), [recipe.ingredients]);

  const servingsLabel = recipe.servings
    ? `${trim(recipe.servings * factor)} ${recipe.servingsNoun}`
    : factor === 1
      ? "Scale"
      : `${trim(factor)}× batch`;

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  async function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    await fetch(`/api/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: next }),
    });
    router.refresh();
  }

  async function addToList() {
    const response = await fetch(`/api/recipes/${recipe.id}/grocery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factor }),
    });
    const data = (await response.json()) as { added?: number; merged?: number };
    flash(
      data.merged
        ? `Added ${data.added} · merged ${data.merged} into what was there`
        : `Added ${data.added ?? 0} items to your list`,
    );
    setMenuOpen(false);
  }

  async function share() {
    const text = recipeToPlainText(recipe, factor);
    if (navigator.share) {
      try {
        await navigator.share({ title: recipe.title, text });
        setMenuOpen(false);
        return;
      } catch {
        // The user dismissed the sheet — fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      flash("Recipe copied");
    } catch {
      flash("Couldn't copy — try the print view");
    }
    setMenuOpen(false);
  }

  async function remove() {
    if (!confirm(`Delete “${recipe.title}”? This can't be undone.`)) return;
    await fetch(`/api/recipes/${recipe.id}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  const totalTime = recipe.totalMinutes ?? recipe.cookMinutes ?? recipe.prepMinutes;

  return (
    <div className="-mt-4">
      {/* Hero */}
      <div className="relative">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-b-3xl bg-subtle sm:rounded-3xl">
          {recipe.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={recipe.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-5xl opacity-25" aria-hidden>
              🍲
            </span>
          )}
        </div>

        <div className="no-print absolute inset-x-3 top-3 flex items-start justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-float"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="More actions"
              aria-expanded={menuOpen}
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
                <div className="absolute top-12 right-0 z-20 w-56 overflow-hidden rounded-2xl bg-card py-1 shadow-float">
                  <MenuItem onClick={addToList}>Add to grocery list</MenuItem>
                  <MenuItem onClick={share}>Share / copy</MenuItem>
                  <MenuItem onClick={() => window.print()}>Print</MenuItem>
                  <MenuLink href={`/recipes/${recipe.id}/edit`}>Edit recipe</MenuLink>
                  {recipe.sourceUrl && (
                    <MenuLink href={recipe.sourceUrl} external>
                      Open original
                    </MenuLink>
                  )}
                  <MenuItem onClick={remove} danger>
                    Delete recipe
                  </MenuItem>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="no-print absolute bottom-3 left-3 flex flex-col items-start gap-2">
          {totalTime ? (
            <span className="rounded-full bg-card px-3 py-1.5 text-[13px] font-bold shadow-float">
              {formatMinutesPlain(totalTime)}
            </span>
          ) : null}
          <SourcePill recipe={recipe} credit={credit} />
        </div>

        <button
          type="button"
          onClick={toggleFavorite}
          aria-label={favorite ? "Remove from favourites" : "Add to favourites"}
          aria-pressed={favorite}
          className="no-print pressable absolute right-3 bottom-3 flex h-10 w-10 items-center justify-center rounded-full bg-card text-lg shadow-float"
        >
          <span className={favorite ? "text-accent" : "text-muted"}>{favorite ? "★" : "☆"}</span>
        </button>
      </div>

      {/* Title block */}
      <div className="px-1 pt-5">
        <h1 className="font-display text-[27px] leading-tight font-extrabold">{recipe.title}</h1>

        {(recipe.prepMinutes || recipe.cookMinutes) && (
          <p className="mt-1.5 text-[14px] text-muted">
            {recipe.prepMinutes ? `Prep: ${formatMinutesPlain(recipe.prepMinutes)}` : null}
            {recipe.prepMinutes && recipe.cookMinutes ? "   |   " : null}
            {recipe.cookMinutes ? `Cook: ${formatMinutesPlain(recipe.cookMinutes)}` : null}
          </p>
        )}

        {recipe.description && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-2.5 flex w-full items-start gap-2 text-left"
          >
            <span className={`flex-1 text-[14.5px] leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
              {recipe.description}
            </span>
            <span className="mt-1 shrink-0 text-muted" aria-hidden>
              {expanded ? "⌃" : "›"}
            </span>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="no-print mt-4 flex gap-2.5 px-1">
        <button
          type="button"
          onClick={() => setScaleOpen(true)}
          className="pressable flex flex-1 items-center justify-center gap-2 rounded-full bg-card px-4 py-3 text-[14.5px] font-bold shadow-card"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 3v18M8 3 5 6.5M8 3l3 3.5M16 21V3M16 21l3-3.5M16 21l-3-3.5" />
          </svg>
          {servingsLabel}
        </button>

        {convertible && (
          <button
            type="button"
            onClick={() =>
              setSystem((current) =>
                current === "original" ? "metric" : current === "metric" ? "us" : "original",
              )
            }
            className="pressable flex flex-1 items-center justify-center gap-2 rounded-full bg-card px-4 py-3 text-[14.5px] font-bold shadow-card"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2" />
              <path d="M19 3v4h-4M5 21v-4h4" />
            </svg>
            {system === "original" ? "Convert units" : UNIT_SYSTEM_LABEL[system]}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="no-print mt-5 flex rounded-full bg-subtle p-1 text-[14.5px] font-bold">
        <TabButton active={tab === "ingredients"} onClick={() => setTab("ingredients")}>
          Ingredients
        </TabButton>
        <TabButton active={tab === "directions"} onClick={() => setTab("directions")}>
          Directions
        </TabButton>
      </div>

      <div className="mt-4">
        {tab === "ingredients" ? (
          <IngredientList
            recipe={recipe}
            factor={factor}
            system={system}
            checked={checked}
            onToggle={(index) =>
              setChecked((current) => {
                const next = new Set(current);
                if (next.has(index)) next.delete(index);
                else next.add(index);
                return next;
              })
            }
          />
        ) : (
          <DirectionList recipe={recipe} />
        )}
      </div>

      {/* Always visible in print, whichever tab is open on screen. */}
      <div className="hidden print:block">
        <IngredientList
          recipe={recipe}
          factor={factor}
          system={system}
          checked={new Set()}
          onToggle={() => {}}
        />
        <DirectionList recipe={recipe} />
      </div>

      {recipe.notes && (
        <section className="mt-4 rounded-2xl bg-card p-4 shadow-card print-plain">
          <h2 className="font-display text-[17px] font-extrabold">Notes</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed whitespace-pre-line">{recipe.notes}</p>
        </section>
      )}

      {recipe.nutrition && <NutritionCard recipe={recipe} factor={factor} />}

      {recipe.tags.length > 0 && (
        <div className="no-print mt-4 flex flex-wrap gap-2">
          {recipe.tags.map((tag) => (
            <Link
              key={tag}
              href={`/?tag=${encodeURIComponent(tag)}`}
              className="rounded-full bg-subtle px-3 py-1.5 text-[13px] font-medium text-muted"
            >
              {tag}
            </Link>
          ))}
        </div>
      )}

      {recipe.sourceUrl && (
        <p className="no-print mt-5 px-1 text-[13px] text-muted">
          Saved from{" "}
          <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-accent underline">
            {recipe.sourceName ?? recipe.sourceUrl}
          </a>
        </p>
      )}

      {/* Cook mode */}
      {recipe.steps.length > 0 && (
        <Link
          href={`/recipes/${recipe.id}/cook`}
          className="no-print pressable fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-md items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 font-bold text-white shadow-float"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 4.5v15l13-7.5z" />
          </svg>
          Start cooking
        </Link>
      )}

      {scaleOpen && (
        <ScaleSheet
          recipe={recipe}
          factor={factor}
          onPick={(value) => {
            setFactor(value);
            setScaleOpen(false);
          }}
          onClose={() => setScaleOpen(false)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="no-print fixed inset-x-0 bottom-40 z-50 mx-auto w-fit rounded-full bg-ink px-4 py-2.5 text-[13.5px] font-medium shadow-float"
          style={{ background: "var(--ink)", color: "var(--card)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function SourcePill({ recipe, credit }: { recipe: Recipe; credit: string }) {
  const inner = (
    <>
      <Avatar name={credit} size={22} ring={false} />
      <span className="max-w-[140px] truncate">{credit}</span>
      {recipe.sourceUrl && <span aria-hidden>›</span>}
    </>
  );

  const className =
    "flex items-center gap-2 rounded-full bg-card py-1.5 pr-3 pl-1.5 text-[13px] font-bold shadow-float";

  return recipe.sourceUrl ? (
    <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className={className}>
      {inner}
    </a>
  ) : (
    <span className={className}>{inner}</span>
  );
}

function TabButton({
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
      aria-pressed={active}
      className="flex-1 rounded-full py-2.5 transition"
      style={
        active
          ? { background: "var(--card)", boxShadow: "var(--shadow)" }
          : { color: "var(--muted)" }
      }
    >
      {children}
    </button>
  );
}

function IngredientList({
  recipe,
  factor,
  system,
  checked,
  onToggle,
}: {
  recipe: Recipe;
  factor: number;
  system: UnitSystem;
  checked: Set<number>;
  onToggle: (index: number) => void;
}) {
  if (!recipe.ingredients.length) {
    return (
      <p className="rounded-2xl bg-card p-4 text-[14.5px] text-muted shadow-card">
        No ingredients were saved with this recipe.
      </p>
    );
  }

  let lastGroup: string | null = null;

  return (
    <section className="rounded-2xl bg-card p-4 shadow-card print-plain">
      <h2 className="font-display text-[17px] font-extrabold">Ingredients</h2>
      <ul className="mt-1">
        {recipe.ingredients.map((ingredient, index) => {
          const amount = renderIngredient(ingredient, system, factor);
          const isChecked = checked.has(index);
          const showGroup = ingredient.group && ingredient.group !== lastGroup;
          lastGroup = ingredient.group;

          return (
            <li key={`${ingredient.raw}-${index}`}>
              {showGroup && (
                <p className="mt-3 mb-1 text-[13px] font-bold text-accent">{ingredient.group}</p>
              )}
              <button
                type="button"
                onClick={() => onToggle(index)}
                aria-pressed={isChecked}
                className="flex w-full items-start gap-3 border-t border-line py-3 text-left first:border-t-0"
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[6px] border-2 text-[11px] ${
                    isChecked ? "text-white" : ""
                  }`}
                  style={{
                    borderColor: isChecked ? "var(--ink)" : "var(--line)",
                    background: isChecked ? "var(--ink)" : "transparent",
                    color: isChecked ? "var(--card)" : undefined,
                  }}
                >
                  {isChecked ? "✓" : ""}
                </span>
                <span
                  className={`flex-1 text-[15px] leading-snug ${
                    isChecked ? "text-muted line-through" : ""
                  }`}
                >
                  {amount && <strong className="font-bold">{amount} </strong>}
                  {ingredient.item}
                  {ingredient.note && (
                    <span className="text-muted">, {ingredient.note}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DirectionList({ recipe }: { recipe: Recipe }) {
  if (!recipe.steps.length) {
    return (
      <p className="rounded-2xl bg-card p-4 text-[14.5px] text-muted shadow-card">
        No method was saved with this recipe. Open the original to read it.
      </p>
    );
  }

  let lastGroup: string | null = null;

  return (
    <section className="rounded-2xl bg-card p-4 shadow-card print-plain">
      <h2 className="font-display text-[17px] font-extrabold">Directions</h2>
      <ol className="mt-1">
        {recipe.steps.map((step, index) => {
          const showGroup = step.group && step.group !== lastGroup;
          lastGroup = step.group;

          return (
            <li key={`${step.text}-${index}`}>
              {showGroup && (
                <p className="mt-3 mb-1 text-[13px] font-bold text-accent">{step.group}</p>
              )}
              <div className="flex gap-3 border-t border-line py-3 first:border-t-0">
                <span className="font-display mt-px w-5 shrink-0 text-[15px] font-extrabold text-accent">
                  {index + 1}
                </span>
                <p className="flex-1 text-[15px] leading-relaxed">{step.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function NutritionCard({ recipe, factor }: { recipe: Recipe; factor: number }) {
  const nutrition = recipe.nutrition!;
  const rows: [string, number | null, string][] = [
    ["Calories", nutrition.calories, ""],
    ["Protein", nutrition.protein, "g"],
    ["Carbs", nutrition.carbs, "g"],
    ["Fat", nutrition.fat, "g"],
    ["Fibre", nutrition.fiber, "g"],
    ["Sugar", nutrition.sugar, "g"],
    ["Sodium", nutrition.sodium, "mg"],
  ];
  const shown = rows.filter(([, value]) => value !== null && value > 0);
  if (!shown.length) return null;

  return (
    <section className="mt-4 rounded-2xl bg-card p-4 shadow-card print-plain">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[17px] font-extrabold">Nutrition</h2>
        <span className="text-[12px] text-muted">
          per serving{nutrition.source === "estimated" ? " · estimated" : ""}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-y-3 sm:grid-cols-4">
        {shown.map(([label, value, unit]) => (
          <div key={label}>
            <dt className="text-[12px] text-muted">{label}</dt>
            <dd className="font-display text-[17px] font-extrabold">
              {trim((value ?? 0) * (factor === 1 ? 1 : 1))}
              <span className="text-[12px] font-bold">{unit}</span>
            </dd>
          </div>
        ))}
      </dl>
      {nutrition.source === "estimated" && (
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          Estimated from a small ingredient table — close enough to compare recipes,
          not close enough to count on.
        </p>
      )}
    </section>
  );
}

function ScaleSheet({
  recipe,
  factor,
  onPick,
  onClose,
}: {
  recipe: Recipe;
  factor: number;
  onPick: (value: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/35"
      />
      <div className="relative w-full max-w-md rounded-t-3xl bg-card p-5 pb-8 shadow-float">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--line)" }} />
        <h2 className="font-display text-[19px] font-extrabold">Scale the recipe</h2>
        <p className="mt-1 text-[13.5px] text-muted">
          {recipe.servings
            ? `Written for ${trim(recipe.servings)} ${recipe.servingsNoun}.`
            : "This recipe doesn't say how much it makes, so we scale the amounts."}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {SCALES.map((value) => {
            const active = Math.abs(value - factor) < 0.001;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onPick(value)}
                className="rounded-2xl py-3 text-[14.5px] font-bold"
                style={
                  active
                    ? { background: "var(--accent)", color: "#fff" }
                    : { background: "var(--subtle)", color: "var(--ink)" }
                }
              >
                {recipe.servings
                  ? `${trim(recipe.servings * value)} ${shortNoun(recipe.servingsNoun)}`
                  : `${trim(value)}×`}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full px-4 py-2.5 text-left text-[14.5px] font-medium ${
        danger ? "text-accent" : ""
      }`}
    >
      {children}
    </button>
  );
}

function MenuLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const className = "block w-full px-4 py-2.5 text-left text-[14.5px] font-medium";
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function shortNoun(noun: string): string {
  return noun === "servings" ? "serves" : noun;
}
