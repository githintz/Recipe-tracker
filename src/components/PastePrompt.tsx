"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * The fastest path from "I just copied a link" to a saved recipe.
 *
 * Browsers only hand over the clipboard on a user gesture (and only over
 * HTTPS), so this can't quietly peek the way a native app does. Instead it
 * offers one tap that reads the clipboard, and falls back to a real paste
 * field whenever the read is blocked or comes back with something that isn't
 * a link — which is also what happens on Firefox, where reading is disabled.
 */
export function PastePrompt() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "reading" | "manual">("idle");
  const [value, setValue] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === "manual") inputRef.current?.focus();
  }, [state]);

  async function readClipboard() {
    setNote(null);

    if (!navigator.clipboard?.readText) {
      setState("manual");
      return;
    }

    setState("reading");
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (isLink(text)) {
        router.push(`/import?url=${encodeURIComponent(text)}`);
        return;
      }
      if (text.length > 60) {
        router.push(`/import?mode=text&text=${encodeURIComponent(text.slice(0, 4000))}`);
        return;
      }
      setNote("Nothing link-shaped on the clipboard — paste it here instead.");
      setState("manual");
    } catch {
      setNote("Your browser kept the clipboard private — paste it here instead.");
      setState("manual");
    }
  }

  function submit() {
    const text = value.trim();
    if (!text) return;
    if (isLink(text)) router.push(`/import?url=${encodeURIComponent(text)}`);
    else router.push(`/import?mode=text&text=${encodeURIComponent(text.slice(0, 4000))}`);
  }

  if (state === "manual") {
    return (
      <div className="mb-4 rounded-2xl bg-card p-3 shadow-card">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Paste a link or a caption"
            aria-label="Paste a recipe link"
            className="min-w-0 flex-1 rounded-xl bg-subtle px-3 py-2.5 text-sm outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Go
          </button>
        </div>
        {note && <p className="mt-2 px-1 text-xs text-muted">{note}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={readClipboard}
      className="pressable mb-4 flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-card"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"
        aria-hidden
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="3" width="8" height="4" rx="1" />
          <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {state === "reading" ? "Checking your clipboard…" : "Paste a recipe link"}
        </span>
        <span className="block truncate text-xs text-muted">
          Copy from Instagram, TikTok or any site, then tap here
        </span>
      </span>
      <span className="text-muted" aria-hidden>
        ›
      </span>
    </button>
  );
}

function isLink(text: string): boolean {
  if (!/^https?:\/\/\S+$/i.test(text)) return false;
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}
