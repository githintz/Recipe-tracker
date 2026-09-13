import { listGroceryItems, listRecipes } from "@/lib/db";
import { GroceryList } from "@/components/GroceryList";

export const dynamic = "force-dynamic";

export const metadata = { title: "Grocery list — Ladle" };

export default async function GroceryPage() {
  const items = listGroceryItems();
  const recipeIds = new Set(items.map((item) => item.recipeId).filter(Boolean));
  const recipes = listRecipes().filter((recipe) => recipeIds.has(recipe.id));

  return (
    <main>
      <GroceryList initialItems={items} recipes={recipes} />
    </main>
  );
}
