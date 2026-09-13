"use client";

import { useEffect, useState } from "react";
import type { GroceryItem, Recipe } from "@/lib/types";
import { listGroceryItems, listRecipes } from "@/lib/store";
import { GroceryList } from "@/components/GroceryList";
import { Spinner } from "@/components/Spinner";

export default function GroceryPage() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [list, all] = await Promise.all([listGroceryItems(), listRecipes()]);
      if (cancelled) return;
      const used = new Set(list.map((item) => item.recipeId).filter(Boolean));
      setItems(list);
      setRecipes(all.filter((recipe) => used.has(recipe.id)));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <main><Spinner /></main>;

  return (
    <main>
      <GroceryList initialItems={items} recipes={recipes} />
    </main>
  );
}
