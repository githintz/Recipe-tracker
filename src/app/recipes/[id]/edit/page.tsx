import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipe, listFolders } from "@/lib/db";
import { RecipeEditor } from "@/components/RecipeEditor";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = getRecipe(id);
  if (!recipe) notFound();

  return (
    <main>
      <header className="mb-5 flex items-center gap-3">
        <Link
          href={`/recipes/${recipe.id}`}
          aria-label="Back to recipe"
          className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-subtle"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m15 5-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="font-display text-[24px] font-extrabold">Edit recipe</h1>
      </header>

      <RecipeEditor initial={recipe} folders={listFolders()} recipeId={recipe.id} />
    </main>
  );
}
