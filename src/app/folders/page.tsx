"use client";

import { useCallback, useEffect, useState } from "react";
import type { Folder } from "@/lib/types";
import { listFolders, listRecipes } from "@/lib/store";
import { FolderBoard } from "@/components/FolderBoard";
import { Spinner } from "@/components/Spinner";

export default function FoldersPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [covers, setCovers] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [folderList, recipes] = await Promise.all([listFolders(), listRecipes()]);
    setFolders(folderList);
    setCovers(
      Object.fromEntries(
        folderList.map((folder) => [
          folder.id,
          recipes.find((recipe) => recipe.folderIds?.includes(folder.id))?.imageUrl ?? null,
        ]),
      ),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <main><Spinner /></main>;

  return (
    <main>
      <FolderBoard folders={folders} covers={covers} onChanged={load} />
    </main>
  );
}
