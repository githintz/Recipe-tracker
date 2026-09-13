"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Recipe } from "@/lib/types";
import { getRecipe } from "@/lib/store";
import { RecipeDetail } from "@/components/RecipeDetail";
import { Spinner } from "@/components/Spinner";
import { MissingRecord } from "@/components/MissingRecord";

function RecipeScreen() {
  const id = useSearchParams().get("id");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = id ? await getRecipe(id) : null;
      if (cancelled) return;
      setRecipe(found);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <Spinner />;
  if (!recipe) {
    return (
      <MissingRecord
        title="Recipe not found"
        body="It may have been deleted, or the link was wrong."
      />
    );
  }

  return <RecipeDetail recipe={recipe} />;
}

export default function RecipePage() {
  return (
    <main>
      <Suspense fallback={<Spinner />}>
        <RecipeScreen />
      </Suspense>
    </main>
  );
}
