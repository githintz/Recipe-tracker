"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Recipe } from "@/lib/types";
import { getRecipe } from "@/lib/store";
import { CookMode } from "@/components/CookMode";
import { Spinner } from "@/components/Spinner";
import { MissingRecord } from "@/components/MissingRecord";

function CookScreen() {
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
    return <MissingRecord title="Recipe not found" body="There's nothing here to cook." />;
  }

  return <CookMode recipe={recipe} />;
}

export default function CookPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CookScreen />
    </Suspense>
  );
}
