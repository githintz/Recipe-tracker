import Link from "next/link";
import { listFolders } from "@/lib/db";
import { isLlmAvailable } from "@/lib/extract";
import { ImportWorkbench } from "@/components/ImportWorkbench";

export const dynamic = "force-dynamic";

export const metadata = { title: "Add a recipe — Ladle" };

type SearchParams = Promise<{ url?: string; text?: string; mode?: string }>;

export default async function ImportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

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

      <ImportWorkbench
        folders={listFolders()}
        aiEnabled={isLlmAvailable()}
        initialUrl={params.url ?? ""}
        initialText={params.text ?? ""}
        initialMode={params.mode === "text" && params.text ? "text" : "url"}
      />
    </main>
  );
}
