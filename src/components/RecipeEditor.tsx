"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExtractedRecipe, Folder, Recipe } from "@/lib/types";
import {
  ingredientsToText,
  stepsToText,
  textToIngredients,
  textToSteps,
} from "@/lib/serialize";

type Props = {
  /** The recipe being edited — freshly extracted, or an existing saved one. */
  initial: ExtractedRecipe | Recipe;
  folders: Folder[];
  /** Present when editing something already saved. */
  recipeId?: string;
  onCancel?: () => void;
};

export function RecipeEditor({ initial, folders, recipeId, onCancel }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial.imageUrl ?? "");
  const [servings, setServings] = useState(initial.servings?.toString() ?? "");
  const [servingsNoun, setServingsNoun] = useState(initial.servingsNoun || "servings");
  const [prep, setPrep] = useState(initial.prepMinutes?.toString() ?? "");
  const [cook, setCook] = useState(initial.cookMinutes?.toString() ?? "");
  const [ingredientText, setIngredientText] = useState(
    ingredientsToText(initial.ingredients),
  );
  const [stepText, setStepText] = useState(stepsToText(initial.steps));
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [selectedFolders, setSelectedFolders] = useState<string[]>(
    "folderIds" in initial ? ((initial.folderIds as string[]) ?? []) : [],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const warnings = "warnings" in initial ? initial.warnings : [];

  async function save() {
    if (!title.trim()) {
      setError("Give the recipe a title.");
      return;
    }

    setSaving(true);
    setError(null);

    const prepMinutes = toNumber(prep);
    const cookMinutes = toNumber(cook);

    const payload = {
      ...initial,
      title: title.trim(),
      description: description.trim() || null,
      imageUrl: imageUrl.trim() || null,
      servings: toNumber(servings),
      servingsNoun: servingsNoun.trim() || "servings",
      prepMinutes,
      cookMinutes,
      totalMinutes:
        prepMinutes !== null && cookMinutes !== null ? prepMinutes + cookMinutes : null,
      ingredients: textToIngredients(ingredientText),
      steps: textToSteps(stepText),
      notes: notes.trim() || null,
      tags: tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
      folderIds: selectedFolders,
    };

    try {
      const response = await fetch(
        recipeId ? `/api/recipes/${recipeId}` : "/api/recipes",
        {
          method: recipeId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = (await response.json()) as { recipe?: Recipe; error?: string };
      if (!response.ok || !data.recipe) {
        setError(data.error ?? "Couldn't save that recipe.");
        setSaving(false);
        return;
      }

      router.push(`/recipes/${data.recipe.id}`);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {warnings.length > 0 && (
        <div className="rounded-xl border border-line bg-accent-soft p-3 text-sm">
          <p className="font-medium text-accent">Worth a look before you save</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Miso butter noodles"
          className={inputClass}
        />
      </Field>

      <Field label="Description" hint="Optional">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Serves">
          <div className="flex gap-2">
            <input
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              inputMode="decimal"
              placeholder="4"
              className={`${inputClass} w-16`}
            />
            <input
              value={servingsNoun}
              onChange={(e) => setServingsNoun(e.target.value)}
              placeholder="servings"
              className={`${inputClass} min-w-0 flex-1`}
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Prep (min)">
            <input
              value={prep}
              onChange={(e) => setPrep(e.target.value)}
              inputMode="numeric"
              className={inputClass}
            />
          </Field>
          <Field label="Cook (min)">
            <input
              value={cook}
              onChange={(e) => setCook(e.target.value)}
              inputMode="numeric"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <Field
        label="Ingredients"
        hint="One per line. End a line with “:” to start a section."
      >
        <textarea
          value={ingredientText}
          onChange={(e) => setIngredientText(e.target.value)}
          rows={10}
          placeholder={"For the sauce:\n2 tbsp white miso\n1 tbsp honey"}
          className={`${inputClass} font-mono text-[13px] leading-relaxed`}
        />
      </Field>

      <Field label="Method" hint="One step per line.">
        <textarea
          value={stepText}
          onChange={(e) => setStepText(e.target.value)}
          rows={10}
          placeholder="Bring a large pot of salted water to the boil."
          className={`${inputClass} text-[14px] leading-relaxed`}
        />
      </Field>

      <Field label="Notes" hint="Optional">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={inputClass}
        />
      </Field>

      <Field label="Tags" hint="Comma separated">
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="weeknight, pasta, vegetarian"
          className={inputClass}
        />
      </Field>

      <Field label="Image URL" hint="Optional">
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          className={inputClass}
        />
      </Field>

      {folders.length > 0 && (
        <Field label="Folders">
          <div className="flex flex-wrap gap-2">
            {folders.map((folder) => {
              const active = selectedFolders.includes(folder.id);
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() =>
                    setSelectedFolders((current) =>
                      active
                        ? current.filter((id) => id !== folder.id)
                        : [...current, folder.id],
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    active
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-card text-muted"
                  }`}
                >
                  {folder.emoji} {folder.name}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {error && (
        <p className="rounded-xl border border-accent bg-accent-soft p-3 text-sm text-accent">
          {error}
        </p>
      )}

      <div className="sticky bottom-20 flex gap-2 pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : recipeId ? "Save changes" : "Save to recipe box"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-line bg-card px-5 py-3 font-medium"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-accent";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
