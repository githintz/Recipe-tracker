import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ title?: string; text?: string; url?: string }>;

/**
 * Where the OS share sheet lands. Android hands the shared link over in
 * whichever field it feels like — sometimes `url`, often `text` with the link
 * buried in it — so we dig the link out and hand the import screen either a
 * URL or the raw text to parse.
 */
export default async function SharePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { text = "", url = "" } = await searchParams;

  const shared = url.trim() || findLink(text) || "";
  if (shared) redirect(`/import?url=${encodeURIComponent(shared)}`);

  if (text.trim()) {
    redirect(`/import?mode=text&text=${encodeURIComponent(text.trim().slice(0, 4000))}`);
  }

  redirect("/import");
}

function findLink(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  // Strip trailing punctuation a share sheet may have carried along.
  return match[0].replace(/[),.]+$/, "");
}
