import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRecipe } from "@/lib/db";
import { RecipeDetail } from "@/components/RecipeDetail";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const recipe = getRecipe(id);
  return {
    title: recipe ? `${recipe.title} — Ladle` : "Recipe — Ladle",
    description: recipe?.description ?? undefined,
  };
}

export default async function RecipePage({ params }: Props) {
  const { id } = await params;
  const recipe = getRecipe(id);
  if (!recipe) notFound();

  return (
    <main>
      <RecipeDetail recipe={recipe} />
    </main>
  );
}
