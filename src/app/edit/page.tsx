"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Folder, Recipe } from "@/lib/types";
import { getRecipe, listFolders } from "@/lib/store";
import { RecipeEditor } from "@/components/RecipeEditor";
import { Spinner } from "@/components/Spinner";
import { MissingRecord } from "@/components/MissingRecord";

function EditScreen() {
  const id = useSearchParams().get("id");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [found, folderList] = await Promise.all([
        id ? getRecipe(id) : Promise.resolve(null),
        listFolders(),
      ]);
      if (cancelled) return;
      setRecipe(found);
      setFolders(folderList);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <Spinner />;
  if (!recipe) {
    return <MissingRecord title="Recipe not found" body="There's nothing here to edit." />;
  }

  return (
    <>
      <header className="mb-5 flex items-center gap-3">
        <Link
          href={`/recipe/?id=${recipe.id}`}
          aria-label="Back to recipe"
          className="pressable flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "var(--subtle)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m15 5-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="font-display text-[24px] font-extrabold">Edit recipe</h1>
      </header>
      <RecipeEditor initial={recipe} folders={folders} recipeId={recipe.id} />
    </>
  );
}

export default function EditPage() {
  return (
    <main>
      <Suspense fallback={<Spinner />}>
        <EditScreen />
      </Suspense>
    </main>
  );
}
