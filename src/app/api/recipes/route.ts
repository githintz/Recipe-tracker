import { NextResponse } from "next/server";
import { createRecipe, listRecipes } from "@/lib/db";
import type { ExtractedRecipe } from "@/lib/types";
import { setRecipeFolders } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recipes = listRecipes({
    search: searchParams.get("q") ?? undefined,
    folderId: searchParams.get("folder") ?? undefined,
    tag: searchParams.get("tag") ?? undefined,
    favoritesOnly: searchParams.get("favorites") === "1",
    sort: (searchParams.get("sort") as "recent" | "title" | "time" | null) ?? undefined,
  });
  return NextResponse.json({ recipes });
}

export async function POST(request: Request) {
  let body: ExtractedRecipe & { folderIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!body?.title?.trim()) {
    return NextResponse.json({ error: "A recipe needs a title." }, { status: 400 });
  }

  const recipe = createRecipe({
    ...body,
    title: body.title.trim(),
    ingredients: Array.isArray(body.ingredients) ? body.ingredients : [],
    steps: Array.isArray(body.steps) ? body.steps : [],
    tags: Array.isArray(body.tags) ? body.tags : [],
    warnings: [],
  });

  if (body.folderIds?.length) setRecipeFolders(recipe.id, body.folderIds);

  return NextResponse.json({ recipe }, { status: 201 });
}
