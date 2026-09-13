/**
 * Turns whatever a share sheet handed us into a route. Android hands the link
 * over in whichever field it feels like — sometimes a url, more often a blob of
 * text with the link buried in it — so we dig it out either way.
 */
export function routeForShared(shared: {
  text?: string | null;
  url?: string | null;
}): string {
  const url = shared.url?.trim() || findLink(shared.text ?? "");
  if (url) return `/import/?url=${encodeURIComponent(url)}`;

  const text = shared.text?.trim();
  if (text) return `/import/?mode=text&text=${encodeURIComponent(text.slice(0, 4000))}`;

  return "/import/";
}

export function findLink(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  // Strip trailing punctuation a share sheet may have carried along.
  return match[0].replace(/[),.]+$/, "") || null;
}
