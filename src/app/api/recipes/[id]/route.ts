import { NextResponse } from "next/server";
import { deleteRecipe, getRecipe, updateRecipe } from "@/lib/db";
import type { Recipe } from "@/lib/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const recipe = getRecipe(id);
  if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  return NextResponse.json({ recipe });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  let patch: Partial<Recipe>;
  try {
    patch = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const recipe = updateRecipe(id, patch);
  if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  return NextResponse.json({ recipe });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!deleteRecipe(id)) {
    return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
