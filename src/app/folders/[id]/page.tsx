import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getFolder, listRecipes } from "@/lib/db";
import { FolderDetail } from "@/components/FolderDetail";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const folder = getFolder(id);
  return { title: folder ? `${folder.name} — Ladle` : "Folder — Ladle" };
}

export default async function FolderPage({ params }: Props) {
  const { id } = await params;
  const folder = getFolder(id);
  if (!folder) notFound();

  const recipes = listRecipes({ folderId: id });
  const available = listRecipes().filter((recipe) => !recipe.folderIds?.includes(id));

  return (
    <main>
      <FolderDetail folder={folder} recipes={recipes} available={available} />
    </main>
  );
}
