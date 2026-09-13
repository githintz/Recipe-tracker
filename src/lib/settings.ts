"use client";

/**
 * Small per-device preferences. The Claude API key lives here rather than in a
 * build-time environment variable, because there is no server to hold it: the
 * app is on your phone, so the key is too.
 *
 * That is a real trade-off, and worth being plain about. The key sits in this
 * app's private storage, which other apps can't read on a normal device. But
 * anyone with the unlocked phone can find it, and calls are billed to your
 * account. Use a key you're willing to rotate, and don't put one in a build you
 * hand to someone else.
 */

const KEY_STORAGE = "ladle.anthropicKey";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private windows and locked-down WebViews can throw on access.
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Nothing we can do; the app still works without AI imports.
  }
}

export function getApiKey(): string | null {
  const key = safeGet(KEY_STORAGE)?.trim();
  return key ? key : null;
}

export function setApiKey(key: string | null): void {
  safeSet(KEY_STORAGE, key?.trim() ? key.trim() : null);
}

export function hasApiKey(): boolean {
  return getApiKey() !== null;
}

/** A key is only plausible if it looks like one; catches pasted whitespace. */
export function looksLikeApiKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim());
}

/** Shows enough of the key to recognise it, without displaying it. */
export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 12) return "••••";
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
}
