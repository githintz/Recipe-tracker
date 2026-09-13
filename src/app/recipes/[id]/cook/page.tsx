import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/db";
import { CookMode } from "@/components/CookMode";

export const dynamic = "force-dynamic";

export default async function CookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = getRecipe(id);
  if (!recipe) notFound();

  return <CookMode recipe={recipe} />;
}
