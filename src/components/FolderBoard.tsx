"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Folder } from "@/lib/types";
import { EmptyState } from "./EmptyState";

const EMOJI = ["📁", "🍝", "🥗", "🍰", "🌮", "🍜", "🥘", "🍳", "🥖", "🍲", "🥩", "🍛"];

export function FolderBoard({
  folders,
  covers,
}: {
  folders: Folder[];
  covers: Record<string, string | null>;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, emoji }),
    });
    setName("");
    setEmoji(EMOJI[0]);
    setCreating(false);
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-[27px] font-extrabold">Folders</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="pressable flex h-9 w-9 items-center justify-center rounded-full text-white"
          style={{ background: "var(--accent)" }}
          aria-label="New folder"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      {folders.length === 0 ? (
        <EmptyState
          emoji="🗂"
          title="No folders yet"
          body="Folders keep a big recipe box usable — weeknights, baking, things to try. A recipe can sit in as many as you like."
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5">
          {folders.map((folder) => (
            <Link key={folder.id} href={`/folders/${folder.id}`} className="pressable block">
              <div className="aspect-square w-full overflow-hidden rounded-2xl bg-subtle">
                {covers[folder.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={covers[folder.id]!} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-3xl opacity-40" aria-hidden>
                    {folder.emoji}
                  </span>
                )}
              </div>
              <h2 className="font-display mt-2.5 line-clamp-2 text-[15px] leading-tight font-bold">
                {folder.name}
              </h2>
              <p className="mt-0.5 text-[13px] text-muted">
                {folder.recipeCount} {folder.recipeCount === 1 ? "recipe" : "recipes"}
              </p>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => setCreating(false)}
            className="absolute inset-0 bg-black/35"
          />
          <div className="relative w-full max-w-md rounded-t-3xl bg-card p-5 pb-8 shadow-float">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--line)" }} />
            <h2 className="font-display text-[19px] font-extrabold">New folder</h2>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Weeknight dinners"
              aria-label="Folder name"
              autoFocus
              className="mt-4 w-full rounded-2xl bg-subtle px-4 py-3 text-[15px] outline-none"
            />

            <div className="scroll-row mt-3 flex gap-2 overflow-x-auto">
              {EMOJI.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setEmoji(option)}
                  aria-pressed={emoji === option}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
                  style={{
                    background: emoji === option ? "var(--accent-soft)" : "var(--subtle)",
                    outline: emoji === option ? "2px solid var(--accent)" : "none",
                  }}
                >
                  {option}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={create}
              disabled={busy || !name.trim()}
              className="pressable mt-4 w-full rounded-full py-3.5 font-bold text-white disabled:opacity-40"
              style={{ background: "var(--accent)" }}
            >
              Create folder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
