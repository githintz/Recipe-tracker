import Link from "next/link";
import type { Recipe } from "@/lib/types";
import { Avatar } from "./Avatar";
import { formatMinutesPlain } from "@/lib/format";

function creditFor(recipe: Recipe): string {
  return recipe.author ?? recipe.sourceName ?? "Your recipe";
}

/**
 * The grid tile: a rounded photo with the creator's avatar tucked into its
 * bottom-left corner, then a bold title and a grey credit line.
 */
export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const credit = creditFor(recipe);

  return (
    <Link href={`/recipe/?id=${recipe.id}`} className="pressable group block">
      <div className="relative">
        <div className="aspect-square w-full overflow-hidden rounded-2xl bg-subtle">
          {recipe.imageUrl ? (
            // Recipe images come from hosts we can't enumerate ahead of time,
            // so they're served directly rather than through the optimiser.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center text-3xl opacity-30"
              aria-hidden
            >
              🍲
            </span>
          )}
        </div>

        <span className="absolute -bottom-2 left-2">
          <Avatar name={credit} size={30} />
        </span>

        {recipe.favorite && (
          <span
            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-card/95 text-sm text-accent shadow-card"
            aria-label="Favourite"
          >
            ★
          </span>
        )}
      </div>

      <h3 className="font-display mt-3.5 line-clamp-2 text-[15px] leading-tight font-bold">
        {recipe.title}
      </h3>
      <p className="mt-0.5 truncate text-[13px] text-muted">{credit}</p>
    </Link>
  );
}

/** The list row used inside folders and the grocery list's recipe strip. */
export function RecipeRow({ recipe }: { recipe: Recipe }) {
  const credit = creditFor(recipe);
  const minutes = recipe.totalMinutes ?? recipe.cookMinutes ?? recipe.prepMinutes;

  return (
    <Link href={`/recipe/?id=${recipe.id}`} className="pressable flex items-center gap-3 py-2.5">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-subtle">
        {recipe.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-lg opacity-30" aria-hidden>
            🍲
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="font-display truncate text-[15px] font-bold">{recipe.title}</h3>
        <p className="mt-0.5 truncate text-[13px] text-muted">
          {credit}
          {minutes ? ` · ${formatMinutesPlain(minutes)}` : ""}
        </p>
      </div>

      <Avatar name={credit} size={26} ring={false} />
    </Link>
  );
}

/** The small tile used in horizontal scroll strips. */
export function RecipeChip({ recipe }: { recipe: Recipe }) {
  return (
    <Link href={`/recipe/?id=${recipe.id}`} className="pressable block w-[104px] shrink-0">
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-subtle">
        {recipe.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xl opacity-30" aria-hidden>
            🍲
          </span>
        )}
      </div>
      <p className="font-display mt-1.5 line-clamp-2 text-[12.5px] leading-tight font-bold">
        {recipe.title}
      </p>
    </Link>
  );
}
