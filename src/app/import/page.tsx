"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Folder } from "@/lib/types";
import { listFolders } from "@/lib/store";
import { ImportWorkbench } from "@/components/ImportWorkbench";
import { Spinner } from "@/components/Spinner";

function ImportScreen() {
  const params = useSearchParams();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await listFolders();
      if (cancelled) return;
      setFolders(list);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <Spinner />;

  const url = params.get("url") ?? "";
  const text = params.get("text") ?? "";

  return (
    <ImportWorkbench
      folders={folders}
      initialUrl={url}
      initialText={text}
      initialMode={params.get("mode") === "text" && text ? "text" : "url"}
    />
  );
}

export default function ImportPage() {
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
        <h1 className="font-display text-[25px] font-extrabold">Add a recipe</h1>
      </header>
      <Suspense fallback={<Spinner />}>
        <ImportScreen />
      </Suspense>
    </main>
  );
}
