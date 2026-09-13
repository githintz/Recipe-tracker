"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { routeForShared } from "@/lib/share";

declare global {
  interface Window {
    /** Set by the Android host when a share arrives before the app has booted. */
    __ladleShared?: string;
  }
}

/**
 * Picks up text shared into the app from another app's share sheet and routes
 * it into the importer.
 *
 * The Android side both sets a property and fires an event, because a share can
 * land either before or after this code runs. We handle whichever arrives and
 * ignore repeats — the host delivers a few times to survive a page load.
 */
export function ShareListener() {
  const router = useRouter();

  useEffect(() => {
    let handled: string | null = null;

    const consume = (text: string | undefined) => {
      const trimmed = text?.trim();
      if (!trimmed || trimmed === handled) return;
      handled = trimmed;

      // Clear it so re-opening the app doesn't re-import the same post.
      try {
        delete window.__ladleShared;
      } catch {
        window.__ladleShared = undefined;
      }

      router.push(routeForShared({ text: trimmed }));
    };

    consume(window.__ladleShared);

    const onShared = (event: Event) => {
      consume((event as CustomEvent<string>).detail);
    };

    window.addEventListener("ladle:shared", onShared);
    return () => window.removeEventListener("ladle:shared", onShared);
  }, [router]);

  return null;
}
