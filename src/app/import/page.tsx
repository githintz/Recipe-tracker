import { listFolders } from "@/lib/db";
import { isLlmAvailable } from "@/lib/extract";
import { ImportWorkbench } from "@/components/ImportWorkbench";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ url?: string; text?: string; mode?: string }>;

export default async function ImportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  return (
    <main>
      <header className="mb-5">
        <h1 className="font-display text-3xl font-bold tracking-tight">Add a recipe</h1>
        <p className="mt-0.5 text-sm text-muted">
          Paste a link, drop in some text, photograph a page, or write it yourself.
        </p>
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
