"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Folder, Recipe } from "@/lib/types";
import { getFolder, listRecipes } from "@/lib/store";
import { FolderDetail } from "@/components/FolderDetail";
import { Spinner } from "@/components/Spinner";
import { MissingRecord } from "@/components/MissingRecord";

function FolderScreen() {
  const id = useSearchParams().get("id");
  const [folder, setFolder] = useState<Folder | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [available, setAvailable] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    const [found, inFolder, all] = await Promise.all([
      getFolder(id),
      listRecipes({ folderId: id }),
      listRecipes(),
    ]);
    setFolder(found);
    setRecipes(inFolder);
    setAvailable(all.filter((recipe) => !recipe.folderIds?.includes(id)));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Spinner />;
  if (!folder) {
    return <MissingRecord title="Folder not found" body="It may have been deleted." />;
  }

  return (
    <FolderDetail
      folder={folder}
      recipes={recipes}
      available={available}
      onChanged={load}
    />
  );
}

export default function FolderPage() {
  return (
    <main>
      <Suspense fallback={<Spinner />}>
        <FolderScreen />
      </Suspense>
    </main>
  );
}
