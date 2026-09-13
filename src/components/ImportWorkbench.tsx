"use client";

import { useEffect, useRef, useState } from "react";
import type { ExtractedRecipe, Folder } from "@/lib/types";
import { RecipeEditor } from "./RecipeEditor";
import { emptyRecipeDraft } from "@/lib/draft";

type Mode = "url" | "text" | "photo" | "write";

const MODES: { id: Mode; label: string; icon: string }[] = [
  { id: "url", label: "Link", icon: "🔗" },
  { id: "text", label: "Text", icon: "¶" },
  { id: "photo", label: "Photo", icon: "📷" },
  { id: "write", label: "Write", icon: "✎" },
];

type Props = {
  folders: Folder[];
  aiEnabled: boolean;
  initialUrl: string;
  initialText: string;
  initialMode: Mode;
};

export function ImportWorkbench({
  folders,
  aiEnabled,
  initialUrl,
  initialText,
  initialMode,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [draft, setDraft] = useState<ExtractedRecipe | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const autoRan = useRef(false);

  async function runImport(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as {
        recipe?: ExtractedRecipe;
        error?: string;
        hint?: string;
      };

      if (!response.ok || !data.recipe) {
        setError({ message: data.error ?? "That import didn't work.", hint: data.hint });
        return;
      }
      setDraft(data.recipe);
    } catch {
      setError({ message: "Couldn't reach the server. Check your connection." });
    } finally {
      setBusy(false);
    }
  }

  // A link arriving from the share sheet should import without a second tap.
  useEffect(() => {
    if (autoRan.current) return;
    if (initialUrl.trim()) {
      autoRan.current = true;
      void runImport({ mode: "url", url: initialUrl });
    } else if (initialText.trim()) {
      autoRan.current = true;
      void runImport({ mode: "text", text: initialText });
    }
    // Only ever fires for the values present on first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function importPhoto(file: File) {
    if (file.size > 10_000_000) {
      setError({ message: "That image is too large — keep it under 10 MB." });
      return;
    }

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        resolve(result.slice(result.indexOf(",") + 1));
      };
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    }).catch(() => null);

    if (!base64) {
      setError({ message: "Couldn't read that image." });
      return;
    }

    await runImport({ mode: "image", image: base64, mediaType: file.type });
  }

  if (draft) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-card px-3 py-2.5 text-sm">
          <span className="text-muted">
            Read from <strong className="text-ink">{sourceLabel(draft)}</strong>
          </span>
          <button
            type="button"
            onClick={() => setDraft(null)}
            className="font-medium text-accent"
          >
            Start over
          </button>
        </div>
        <RecipeEditor initial={draft} folders={folders} onCancel={() => setDraft(null)} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-4 gap-1.5">
        {MODES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              setMode(option.id);
              setError(null);
            }}
            className={`rounded-xl border px-2 py-2.5 text-sm ${
              mode === option.id
                ? "border-accent bg-accent-soft font-medium text-accent"
                : "border-line bg-card text-muted"
            }`}
          >
            <span className="block text-base" aria-hidden>
              {option.icon}
            </span>
            {option.label}
          </button>
        ))}
      </div>

      {mode === "url" && (
        <section className="space-y-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && url.trim()) void runImport({ mode: "url", url });
            }}
            type="url"
            inputMode="url"
            autoCapitalize="none"
            placeholder="https://instagram.com/reel/…"
            aria-label="Recipe link"
            className="w-full rounded-xl border border-line bg-card px-3 py-3 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={busy || !url.trim()}
            onClick={() => void runImport({ mode: "url", url })}
            className="w-full rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {busy ? "Reading the page…" : "Import recipe"}
          </button>
          <p className="text-xs text-muted">
            Works with Instagram, TikTok, YouTube and any recipe site. Recipes only
            come through if the creator wrote them down — a method that is only
            spoken in a video isn&apos;t in the page to read.
          </p>
        </section>
      )}

      {mode === "text" && (
        <section className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder={"Paste a caption, an email, or a note from a friend…"}
            aria-label="Recipe text"
            className="w-full rounded-xl border border-line bg-card px-3 py-3 text-sm leading-relaxed outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={busy || text.trim().length < 20}
            onClick={() => void runImport({ mode: "text", text })}
            className="w-full rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {busy ? "Reading it…" : "Import recipe"}
          </button>
          <p className="text-xs text-muted">
            The most reliable route when a link won&apos;t open — copy the caption
            straight out of the app and drop it here.
          </p>
        </section>
      )}

      {mode === "photo" && (
        <section className="space-y-3">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importPhoto(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy || !aiEnabled}
            onClick={() => fileInput.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-card px-6 py-12 disabled:opacity-50"
          >
            <span className="text-3xl" aria-hidden>
              📷
            </span>
            <span className="font-medium">
              {busy ? "Reading the page…" : "Take or choose a photo"}
            </span>
            <span className="text-xs text-muted">
              A cookbook page, a recipe card, a screenshot
            </span>
          </button>
          {!aiEnabled && (
            <p className="rounded-xl border border-line bg-accent-soft p-3 text-xs text-muted">
              Reading a photo needs an Anthropic API key. Set{" "}
              <code className="font-mono">ANTHROPIC_API_KEY</code> and restart, or
              type the recipe in under <strong>Write</strong>.
            </p>
          )}
        </section>
      )}

      {mode === "write" && (
        <section>
          <RecipeEditor initial={emptyRecipeDraft()} folders={folders} />
        </section>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-accent bg-accent-soft p-3 text-sm">
          <p className="font-medium text-accent">{error.message}</p>
          {error.hint && <p className="mt-1 text-muted">{error.hint}</p>}
        </div>
      )}

      {!aiEnabled && mode !== "photo" && (
        <p className="mt-6 rounded-xl border border-line bg-card p-3 text-xs text-muted">
          Running without an API key. Recipe sites with structured data import
          perfectly; social captions and free-form blogs fall back to a built-in
          parser that gets the common shapes right but not every one. Set{" "}
          <code className="font-mono">ANTHROPIC_API_KEY</code> for the rest.
        </p>
      )}
    </div>
  );
}

function sourceLabel(recipe: ExtractedRecipe): string {
  switch (recipe.extractedBy) {
    case "structured-data":
      return `${recipe.sourceName ?? "the page"} (structured data)`;
    case "microdata":
      return `${recipe.sourceName ?? "the page"} (page markup)`;
    case "ai":
      return `${recipe.sourceName ?? "the text"}, read by Claude`;
    case "ai-vision":
      return "your photo, read by Claude";
    case "heuristic":
      return `${recipe.sourceName ?? "the text"}, parsed offline`;
    default:
      return "scratch";
  }
}
