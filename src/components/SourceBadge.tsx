import type { Recipe } from "@/lib/types";

const LABELS: Record<Recipe["sourceType"], { icon: string; name: string }> = {
  instagram: { icon: "◎", name: "Instagram" },
  tiktok: { icon: "♪", name: "TikTok" },
  youtube: { icon: "▷", name: "YouTube" },
  web: { icon: "⌘", name: "Web" },
  text: { icon: "¶", name: "Pasted" },
  photo: { icon: "⊡", name: "Photo" },
  manual: { icon: "✎", name: "Yours" },
};

export function SourceBadge({ recipe }: { recipe: Recipe }) {
  const meta = LABELS[recipe.sourceType] ?? LABELS.web;
  const name = recipe.sourceName ?? meta.name;

  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden>{meta.icon}</span>
      <span className="truncate">{recipe.author ?? name}</span>
    </span>
  );
}
