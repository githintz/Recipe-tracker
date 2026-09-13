"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Recipe } from "@/lib/types";
import { renderIngredient, type UnitSystem } from "@/lib/units";

/**
 * Full-screen, one-step-at-a-time cooking view. It holds a screen wake lock so
 * the phone doesn't sleep mid-recipe, keeps the ingredient list a tap away, and
 * turns any duration written in a step into a timer you can start.
 */
export function CookMode({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [awake, setAwake] = useState(false);

  const step = recipe.steps[index];
  const isLast = index === recipe.steps.length - 1;
  const system: UnitSystem = "original";

  // Keep the screen on while cooking. Not every browser supports this, and the
  // lock is dropped whenever the tab is hidden, so it's re-taken on return.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      if (!("wakeLock" in navigator)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        setAwake(true);
        lock.addEventListener("release", () => setAwake(false));
      } catch {
        setAwake(false);
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void acquire();
    }

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release().catch(() => {});
    };
  }, []);

  const next = useCallback(() => {
    setIndex((current) => Math.min(current + 1, recipe.steps.length - 1));
  }, [recipe.steps.length]);

  const previous = useCallback(() => {
    setIndex((current) => Math.max(current - 1, 0));
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === " ") next();
      if (event.key === "ArrowLeft") previous();
      if (event.key === "Escape") router.push(`/recipe/?id=${recipe.id}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, previous, router, recipe.id]);

  if (!step) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-8 text-center">
        <p className="text-muted">This recipe has no method to cook from.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper">
      <header className="pt-safe flex items-center gap-3 px-4 pb-2">
        <button
          type="button"
          onClick={() => router.push(`/recipe/?id=${recipe.id}`)}
          aria-label="Leave cook mode"
          className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-subtle"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold">{recipe.title}</p>
          <p className="text-[12px] text-muted">
            Step {index + 1} of {recipe.steps.length}
            {awake ? " · screen staying on" : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowIngredients(true)}
          className="pressable rounded-full bg-subtle px-3.5 py-2 text-[13px] font-bold"
        >
          Ingredients
        </button>
      </header>

      <div className="h-1 w-full bg-subtle">
        <div
          className="h-full rounded-r-full transition-all duration-300"
          style={{
            width: `${((index + 1) / recipe.steps.length) * 100}%`,
            background: "var(--accent)",
          }}
        />
      </div>

      <div className="flex flex-1 flex-col justify-center overflow-y-auto px-6 py-8">
        {step.group && (
          <p className="mb-3 text-[13px] font-bold tracking-wide text-accent uppercase">
            {step.group}
          </p>
        )}
        <p className="font-display text-[26px] leading-snug font-bold sm:text-[30px]">
          {step.text}
        </p>

        <Timers text={step.text} />
      </div>

      <footer className="flex gap-3 px-5 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={previous}
          disabled={index === 0}
          className="pressable rounded-full bg-subtle px-6 py-4 font-bold disabled:opacity-35"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => (isLast ? router.push(`/recipe/?id=${recipe.id}`) : next())}
          className="pressable flex-1 rounded-full px-6 py-4 font-bold text-white"
          style={{ background: "var(--accent)" }}
        >
          {isLast ? "Done" : "Next step"}
        </button>
      </footer>

      {showIngredients && (
        <div className="absolute inset-0 z-10 flex items-end">
          <button
            type="button"
            aria-label="Close ingredients"
            onClick={() => setShowIngredients(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative max-h-[75vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 pb-8 shadow-float">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--line)" }} />
            <h2 className="font-display text-[19px] font-extrabold">Ingredients</h2>
            <ul className="mt-2">
              {recipe.ingredients.map((ingredient, i) => {
                const isChecked = checked.has(i);
                const amount = renderIngredient(ingredient, system, 1);
                return (
                  <li key={`${ingredient.raw}-${i}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setChecked((current) => {
                          const nextSet = new Set(current);
                          if (nextSet.has(i)) nextSet.delete(i);
                          else nextSet.add(i);
                          return nextSet;
                        })
                      }
                      className="flex w-full items-start gap-3 border-t border-line py-3 text-left first:border-t-0"
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[6px] border-2 text-[11px]"
                        style={{
                          borderColor: isChecked ? "var(--ink)" : "var(--line)",
                          background: isChecked ? "var(--ink)" : "transparent",
                          color: "var(--card)",
                        }}
                      >
                        {isChecked ? "✓" : ""}
                      </span>
                      <span className={`text-[15px] ${isChecked ? "text-muted line-through" : ""}`}>
                        {amount && <strong className="font-bold">{amount} </strong>}
                        {ingredient.item}
                        {ingredient.note && <span className="text-muted">, {ingredient.note}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/** Finds durations written into a step ("simmer for 20 minutes") and offers them. */
function Timers({ text }: { text: string }) {
  const durations = extractDurations(text);
  if (!durations.length) return null;

  return (
    <div className="mt-7 flex flex-wrap gap-2">
      {durations.map((minutes) => (
        <Timer key={minutes} minutes={minutes} />
      ))}
    </div>
  );
}

function extractDurations(text: string): number[] {
  const found = new Set<number>();

  for (const match of text.matchAll(/(\d+)(?:\s*(?:-|–|to)\s*(\d+))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi)) {
    // A range ("10-12 minutes") becomes the upper bound: check early, not late.
    const value = Number(match[2] ?? match[1]);
    const unit = match[3].toLowerCase();
    if (!Number.isFinite(value) || value <= 0) continue;

    if (unit.startsWith("h")) found.add(value * 60);
    else if (unit.startsWith("m")) found.add(value);
    else found.add(Math.max(1, Math.round(value / 60)));
  }

  return [...found].filter((m) => m <= 720).sort((a, b) => a - b).slice(0, 3);
}

function Timer({ minutes }: { minutes: number }) {
  const [remaining, setRemaining] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          clearInterval(id);
          setRunning(false);
          if (!doneRef.current) {
            doneRef.current = true;
            void notifyDone(minutes);
          }
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, minutes]);

  const finished = remaining === 0;
  const label = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <button
      type="button"
      onClick={() => {
        if (finished) {
          doneRef.current = false;
          setRemaining(minutes * 60);
          setRunning(true);
          return;
        }
        setRunning((value) => !value);
      }}
      className="pressable rounded-full px-4 py-2.5 text-[14px] font-bold"
      style={
        running || finished
          ? { background: "var(--accent)", color: "#fff" }
          : { background: "var(--subtle)", color: "var(--ink)" }
      }
    >
      {finished ? "⏰ Time's up — reset" : running ? `⏳ ${label}` : `Start ${minutes} min timer`}
    </button>
  );
}

async function notifyDone(minutes: number) {
  try {
    if ("Notification" in window) {
      const permission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
      if (permission === "granted") {
        new Notification("Timer finished", { body: `${minutes} minutes are up.` });
      }
    }
  } catch {
    // Notifications are a nicety; the on-screen state is the real signal.
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Not supported — nothing to do.
  }
}
