import { NextResponse } from "next/server";
import { addRecipeToGroceryList, getRecipe } from "@/lib/db";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/** Adds a recipe's ingredients to the grocery list, scaled as the user is cooking it. */
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const recipe = getRecipe(id);
  if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

  let factor = 1;
  try {
    const body = (await request.json()) as { factor?: number };
    if (typeof body.factor === "number" && body.factor > 0 && body.factor <= 100) {
      factor = body.factor;
    }
  } catch {
    // No body is fine — default to the recipe as written.
  }

  const result = addRecipeToGroceryList(recipe, factor);
  return NextResponse.json(result);
}
