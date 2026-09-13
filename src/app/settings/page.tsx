"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  getApiKey,
  looksLikeApiKey,
  maskApiKey,
  setApiKey,
} from "@/lib/settings";
import { exportAll, importAll, listRecipes } from "@/lib/store";

export default function SettingsPage() {
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSaved(getApiKey());
    void listRecipes().then((recipes) => setCount(recipes.length));
  }, []);

  function save() {
    const key = draft.trim();
    if (!key) return;
    if (!looksLikeApiKey(key)) {
      setNote("That doesn't look like a Claude key — they start with “sk-ant-”.");
      return;
    }
    setApiKey(key);
    setSaved(key);
    setDraft("");
    setEditing(false);
    setNote("Key saved on this device.");
  }

  function forget() {
    setApiKey(null);
    setSaved(null);
    setNote("Key removed from this device.");
  }

  async function backup() {
    const json = await exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ladle-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function restore(file: File) {
    try {
      const result = await importAll(await file.text());
      setNote(
        `Restored ${result.recipes} recipe${result.recipes === 1 ? "" : "s"}` +
          `${result.folders ? ` and ${result.folders} folders` : ""}.`,
      );
      void listRecipes().then((recipes) => setCount(recipes.length));
    } catch {
      setNote("That file didn't look like a Ladle backup.");
    }
  }

  return (
    <main>
      <header className="mb-5 flex items-center gap-3">
        <Link
          href="/"
          aria-label="Back to recipes"
          className="pressable flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: "var(--subtle)" }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m15 5-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="font-display text-[25px] font-extrabold">Settings</h1>
      </header>

      <section className="rounded-2xl bg-card p-4 shadow-card">
        <h2 className="font-display text-[17px] font-extrabold">Claude API key</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          Optional. Without it, recipe sites that publish structured data still
          import perfectly and captions fall back to a built-in parser. With it,
          Ladle can read messy captions, free-form blogs and photos of recipes.
        </p>

        {saved && !editing ? (
          <div className="mt-3 flex items-center gap-2">
            <code
              className="flex-1 rounded-xl px-3 py-2.5 font-mono text-[13px]"
              style={{ background: "var(--subtle)" }}
            >
              {maskApiKey(saved)}
            </code>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-xl px-3 py-2.5 text-[13.5px] font-bold"
              style={{ background: "var(--subtle)" }}
            >
              Replace
            </button>
            <button type="button" onClick={forget} className="px-2 text-[13.5px] font-bold text-accent">
              Forget
            </button>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <input
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="sk-ant-…"
              aria-label="Claude API key"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-xl px-3 py-2.5 font-mono text-[13px] outline-none"
              style={{ background: "var(--subtle)" }}
            />
            <button
              type="button"
              onClick={save}
              disabled={!draft.trim()}
              className="rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-40"
              style={{ background: "var(--accent)" }}
            >
              Save
            </button>
          </div>
        )}

        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          The key is stored on this device and sent straight to Anthropic when you
          import — it never passes through a server of ours, because there isn&apos;t
          one. Anyone with your unlocked phone could read it, and usage is billed to
          your account, so use a key you&apos;re willing to rotate.
        </p>
      </section>

      <section className="mt-4 rounded-2xl bg-card p-4 shadow-card">
        <h2 className="font-display text-[17px] font-extrabold">Your recipes</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          {count === null
            ? "Counting…"
            : `${count} recipe${count === 1 ? "" : "s"} stored on this device.`}{" "}
          Nothing is uploaded anywhere, so a backup is the only way to move them to
          another phone — or to get them back after uninstalling.
        </p>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={backup}
            className="flex-1 rounded-xl py-2.5 text-[13.5px] font-bold"
            style={{ background: "var(--subtle)" }}
          >
            Back up to a file
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex-1 rounded-xl py-2.5 text-[13.5px] font-bold"
            style={{ background: "var(--subtle)" }}
          >
            Restore
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void restore(file);
            e.target.value = "";
          }}
        />
        <p className="mt-2 text-[12px] text-muted">
          Restoring merges — it never overwrites what you already have.
        </p>
      </section>

      {note && (
        <p
          className="mt-4 rounded-2xl p-3.5 text-[13.5px] font-medium"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          {note}
        </p>
      )}
    </main>
  );
}
