import { listFolders, listRecipes } from "@/lib/db";
import { FolderBoard } from "@/components/FolderBoard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Folders — Ladle" };

export default async function FoldersPage() {
  const folders = listFolders();
  const recipes = listRecipes();

  const covers = Object.fromEntries(
    folders.map((folder) => [
      folder.id,
      recipes.find((recipe) => recipe.folderIds?.includes(folder.id))?.imageUrl ?? null,
    ]),
  );

  return (
    <main>
      <FolderBoard folders={folders} covers={covers} />
    </main>
  );
}
