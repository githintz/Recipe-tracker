"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ExtractedRecipe, Folder } from "@/lib/types";
import { RecipeEditor } from "./RecipeEditor";
import { emptyRecipeDraft } from "@/lib/draft";
import {
  ImportError,
  MissingKeyError,
  NotARecipeError,
  importFromImage,
  importFromText,
  importFromUrl,
  isLlmAvailable,
} from "@/lib/extract";

type Mode = "url" | "text" | "photo" | "write";

const MODES: { id: Mode; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    id: "url",
    label: "Paste a link",
    hint: "Instagram, TikTok, YouTube or any recipe site",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
      </svg>
    ),
  },
  {
    id: "text",
    label: "Paste text",
    hint: "A caption, an email, a note from a friend",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 5h14M5 10h14M5 15h9M5 20h6" />
      </svg>
    ),
  },
  {
    id: "photo",
    label: "Scan a photo",
    hint: "A cookbook page, a recipe card, a screenshot",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 8V6a2 2 0 0 1 2-2h2M17 4h2a2 2 0 0 1 2 2v2M21 16v2a2 2 0 0 1-2 2h-2M7 20H5a2 2 0 0 1-2-2v-2" />
        <circle cx="12" cy="12" r="3.2" />
      </svg>
    ),
  },
  {
    id: "write",
    label: "Write it yourself",
    hint: "Family recipes, and the ones in your head",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
      </svg>
    ),
  },
];

type Props = {
  folders: Folder[];
  initialUrl: string;
  initialText: string;
  initialMode: Mode;
};

type Source =
  | { kind: "url"; url: string }
  | { kind: "text"; text: string }
  | { kind: "image"; base64: string; mediaType: string };

export function ImportWorkbench({
  folders,
  initialUrl,
  initialText,
  initialMode,
}: Props) {
  // Read once on mount: localStorage isn't available while rendering on the
  // server during the static export.
  const [aiEnabled, setAiEnabled] = useState(false);
  useEffect(() => setAiEnabled(isLlmAvailable()), []);
  const [mode, setMode] = useState<Mode | null>(initialUrl || initialText ? initialMode : null);
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ImportFailure | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [draft, setDraft] = useState<ExtractedRecipe | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const autoRan = useRef(false);

  async function runImport(source: Source) {
    setBusy(true);
    setError(null);
    setShowDetails(false);
    try {
      const recipe =
        source.kind === "url"
          ? await importFromUrl(source.url)
          : source.kind === "text"
            ? await importFromText(source.text)
            : await importFromImage(
                source.base64,
                source.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              );
      setDraft(recipe);
    } catch (thrown) {
      setError(describe(thrown));
    } finally {
      setBusy(false);
    }
  }

  // A link arriving from the share sheet imports without a second tap.
  useEffect(() => {
    if (autoRan.current) return;
    if (initialUrl.trim()) {
      autoRan.current = true;
      void runImport({ kind: "url", url: initialUrl });
    } else if (initialText.trim()) {
      autoRan.current = true;
      void runImport({ kind: "text", text: initialText });
    }
    // Only ever fires for the values present on first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function importPhoto(file: File) {
    if (file.size > 10_000_000) {
      setError({ message: "That image is too large — keep it under 10 MB." });
      return;
    }

    const base64 = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        resolve(result.slice(result.indexOf(",") + 1));
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

    if (!base64) {
      setError({ message: "Couldn't read that image." });
      return;
    }

    await runImport({ kind: "image", base64, mediaType: file.type });
  }

  if (busy) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <span
          className="h-10 w-10 animate-spin rounded-full border-[3px]"
          style={{ borderColor: "var(--subtle)", borderTopColor: "var(--accent)" }}
          aria-hidden
        />
        <p className="font-display mt-5 text-[17px] font-extrabold">Reading the recipe…</p>
        <p className="mt-1 text-[13.5px] text-muted">This usually takes a few seconds.</p>
      </div>
    );
  }

  if (draft) {
    return (
      <div>
        <div
          className="mb-4 flex items-center justify-between rounded-2xl px-4 py-3 text-[13.5px]"
          style={{ background: "var(--accent-soft)" }}
        >
          <span className="text-muted">
            Read from <strong className="font-bold text-ink">{sourceLabel(draft)}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setMode(null);
            }}
            className="font-bold text-accent"
          >
            Start over
          </button>
        </div>
        <RecipeEditor
          initial={draft}
          folders={folders}
          onCancel={() => {
            setDraft(null);
            setMode(null);
          }}
        />
      </div>
    );
  }

  if (mode === null) {
    return (
      <div>
        <div className="space-y-2.5">
          {MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setMode(option.id);
                setError(null);
              }}
              className="pressable flex w-full items-center gap-3.5 rounded-2xl bg-card p-4 text-left shadow-card"
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {option.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-[15.5px] font-extrabold">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[13px] text-muted">{option.hint}</span>
              </span>
              <span className="text-muted" aria-hidden>
                ›
              </span>
            </button>
          ))}
        </div>

        <p className="mt-5 px-1 text-[12.5px] leading-relaxed text-muted">
          Recipes only come through when the creator wrote them down. A method
          that&apos;s only spoken aloud in a video isn&apos;t in the page to read —
          for those, copy the caption or the comments.
        </p>

        {!aiEnabled && <NoKeyNote />}
      </div>
    );
  }

  const active = MODES.find((option) => option.id === mode)!;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setMode(null);
          setError(null);
        }}
        className="mb-4 text-[13.5px] font-bold text-accent"
      >
        ‹ All the ways to add
      </button>

      <h2 className="font-display mb-3 text-[19px] font-extrabold">{active.label}</h2>

      {mode === "url" && (
        <section className="space-y-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && url.trim()) void runImport({ kind: "url", url });
            }}
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoFocus
            placeholder="https://instagram.com/reel/…"
            aria-label="Recipe link"
            className="w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none"
            style={{ background: "var(--subtle)" }}
          />
          <PrimaryButton disabled={!url.trim()} onClick={() => runImport({ kind: "url", url })}>
            Import recipe
          </PrimaryButton>
        </section>
      )}

      {mode === "text" && (
        <section className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            autoFocus
            placeholder="Paste the caption, ingredients and method…"
            aria-label="Recipe text"
            className="w-full rounded-2xl px-4 py-3.5 text-[15px] leading-relaxed outline-none"
            style={{ background: "var(--subtle)" }}
          />
          <PrimaryButton
            disabled={text.trim().length < 20}
            onClick={() => runImport({ kind: "text", text })}
          >
            Import recipe
          </PrimaryButton>
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
            disabled={!aiEnabled}
            onClick={() => fileInput.current?.click()}
            className="pressable relative flex w-full flex-col items-center gap-2 rounded-3xl px-6 py-16 disabled:opacity-50"
            style={{ background: "var(--subtle)" }}
          >
            <ScanCorners />
            <span className="text-3xl" aria-hidden>
              📷
            </span>
            <span className="font-display text-[15.5px] font-extrabold">
              Take or choose a photo
            </span>
            <span className="text-[12.5px] text-muted">
              A cookbook page, a recipe card, a screenshot
            </span>
          </button>
          {!aiEnabled && (
            <p
              className="rounded-2xl p-3.5 text-[12.5px] leading-relaxed text-muted"
              style={{ background: "var(--accent-soft)" }}
            >
              Reading a photo needs a Claude API key.{" "}
              <Link href="/settings" className="font-bold text-accent underline">
                Add one in Settings
              </Link>
              , or write the recipe in by hand.
            </p>
          )}
        </section>
      )}

      {mode === "write" && <RecipeEditor initial={emptyRecipeDraft()} folders={folders} />}

      {error && (
        <div
          className="mt-4 rounded-2xl p-3.5 text-[14px]"
          style={{ background: "var(--accent-soft)" }}
        >
          <p className="font-bold text-accent">{error.message}</p>
          {error.hint && <p className="mt-1 leading-relaxed text-muted">{error.hint}</p>}

          {error.details && error.details.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowDetails((open) => !open)}
                className="mt-2.5 text-[13px] font-bold text-accent underline"
              >
                {showDetails ? "Hide details" : "Show details"}
              </button>

              {showDetails && (
                <>
                  <ul className="mt-2 space-y-1">
                    {error.details.map((line, index) => (
                      <li
                        key={index}
                        className="rounded-lg px-2.5 py-1.5 font-mono text-[11.5px] leading-relaxed text-muted"
                        style={{ background: "var(--card)" }}
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard
                        ?.writeText(
                          [error.message, ...(error.details ?? [])].join("\n"),
                        )
                        .catch(() => {});
                    }}
                    className="mt-2 text-[13px] font-bold text-accent underline"
                  >
                    Copy details
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** The white corner brackets of a scan viewfinder. */
function ScanCorners() {
  const common = "absolute h-8 w-8 border-accent";
  return (
    <span aria-hidden>
      <span className={`${common} top-4 left-4 rounded-tl-xl border-t-[3px] border-l-[3px]`} />
      <span className={`${common} top-4 right-4 rounded-tr-xl border-t-[3px] border-r-[3px]`} />
      <span className={`${common} bottom-4 left-4 rounded-bl-xl border-b-[3px] border-l-[3px]`} />
      <span className={`${common} right-4 bottom-4 rounded-br-xl border-r-[3px] border-b-[3px]`} />
    </span>
  );
}

function PrimaryButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="pressable w-full rounded-full py-3.5 text-[15px] font-bold text-white disabled:opacity-40"
      style={{ background: "var(--accent)" }}
    >
      {children}
    </button>
  );
}

function NoKeyNote() {
  return (
    <p
      className="mt-4 rounded-2xl p-3.5 text-[12.5px] leading-relaxed text-muted"
      style={{ background: "var(--subtle)" }}
    >
      Running without an API key. Recipe sites that publish structured data import
      perfectly; social captions and free-form blogs fall back to a built-in parser
      that handles the common shapes but not every one.{" "}
      <Link href="/settings" className="font-bold text-accent underline">
        Add a Claude API key
      </Link>{" "}
      for the rest, including photo scanning.
    </p>
  );
}

type ImportFailure = { message: string; hint?: string; details?: string[] };

/** Turns whatever the pipeline threw into something worth reading. */
function describe(thrown: unknown): ImportFailure {
  if (thrown instanceof MissingKeyError) {
    return {
      message: "No Claude API key is set.",
      hint: "Add one in Settings, or use a source that writes the recipe out in full.",
    };
  }
  if (thrown instanceof NotARecipeError) {
    return {
      message: thrown.message,
      hint: "Try a post where the recipe is written out in the caption.",
    };
  }
  if (thrown instanceof ImportError) {
    return { message: thrown.message, hint: thrown.hint, details: thrown.details };
  }
  if (thrown instanceof Error) {
    return { message: "Something went wrong reading that recipe.", hint: thrown.message };
  }
  return { message: "Something went wrong reading that recipe." };
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
