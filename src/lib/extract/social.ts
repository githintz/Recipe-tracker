import type { SourceType } from "../types";
import { decodeEntities, metaContent } from "./html";
import {
  BOT_UA,
  BROWSER_UA,
  CRAWLER_UA,
  fetchOEmbed,
  fetchPage,
  type PageResult,
} from "./fetch";

export type SocialPost = {
  platform: SourceType;
  /** The post caption, which is where the recipe usually lives. */
  caption: string | null;
  author: string | null;
  thumbnail: string | null;
  title: string | null;
  /** A readable account of what each attempt returned, for when this fails. */
  diagnostics: string[];
};

export function detectPlatform(url: string): SourceType {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "web";
  }
  if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
  if (/(^|\.)(tiktok\.com|vm\.tiktok\.com)$/.test(host)) return "tiktok";
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return "youtube";
  return "web";
}

/** Signs that we were handed a sign-in wall instead of the post. */
function looksLikeLoginWall(html: string): boolean {
  const head = html.slice(0, 30_000);
  return (
    /login|Log in to (?:Instagram|TikTok)|accounts\/login|"is_logged_in":false/i.test(head) &&
    !/og:description/i.test(head)
  );
}

/**
 * Social pages are built in the browser, so the served HTML is largely a shell.
 * The caption still reaches us three ways: the link-preview meta tags, the
 * platform's oEmbed endpoint, and inline JSON in the shell.
 *
 * The user agent decides which of those we get. Logged-out browsers are shown a
 * sign-in wall, while the crawlers that build link previews are still given the
 * preview — caption included — so we ask as a crawler first and fall back.
 */
export async function fetchSocialPost(
  url: string,
  platform: SourceType,
): Promise<SocialPost> {
  const diagnostics: string[] = [];
  const candidates: string[] = [];

  let author: string | null = null;
  let thumbnail: string | null = null;
  let title: string | null = null;

  const attempts: { label: string; ua: string }[] = [
    { label: "link-preview crawler", ua: CRAWLER_UA },
    { label: "search crawler", ua: BOT_UA },
    { label: "desktop browser", ua: BROWSER_UA },
  ];

  for (const attempt of attempts) {
    let page: PageResult;
    try {
      page = await fetchPage(url, { userAgent: attempt.ua });
    } catch (error) {
      diagnostics.push(
        `${attempt.label}: ${error instanceof Error ? error.message : "request failed"}`,
      );
      continue;
    }

    const found = harvest(page.html);
    author ??= found.author;
    thumbnail ??= found.thumbnail;
    title ??= found.title;

    const best = found.captions.map(cleanCaption).filter(Boolean).sort(
      (a, b) => b!.length - a!.length,
    )[0];

    diagnostics.push(
      `${attempt.label}: HTTP ${page.status}, ${Math.round(page.html.length / 1024)} KB` +
        (found.captions.length ? `, ${found.captions.length} caption source(s)` : ", no caption tags") +
        (best ? `, longest ${best.length} chars` : "") +
        (looksLikeLoginWall(page.html) ? ", looks like a sign-in wall" : ""),
    );

    for (const caption of found.captions) candidates.push(caption);

    // A caption long enough to hold a method is worth stopping for; a short one
    // is usually a truncated preview, so keep trying the other agents.
    if (best && best.length > 120) break;
  }

  // oEmbed is a separate route that sometimes works when the HTML doesn't.
  const oembedUrl = oembedEndpoint(url, platform);
  if (oembedUrl) {
    const data = await fetchOEmbed(oembedUrl);
    if (data) {
      let used = 0;
      for (const field of ["title", "description", "caption"] as const) {
        const value = data[field];
        if (typeof value === "string" && value.trim()) {
          candidates.push(value);
          used += 1;
        }
      }
      if (typeof data.author_name === "string") author ??= data.author_name;
      if (typeof data.thumbnail_url === "string") thumbnail ??= data.thumbnail_url;
      diagnostics.push(`oEmbed: ${used} field(s) returned`);
    } else {
      diagnostics.push("oEmbed: no response");
    }
  }

  const caption =
    candidates
      .map((c) => cleanCaption(c))
      .filter((c): c is string => Boolean(c))
      .sort((a, b) => b.length - a.length)[0] ?? null;

  if (!author) author = authorFromUrl(url, platform);

  return { platform, caption, author, thumbnail, title, diagnostics };
}

/** Every place a caption might be hiding in one page of HTML. */
function harvest(html: string): {
  captions: string[];
  author: string | null;
  thumbnail: string | null;
  title: string | null;
} {
  const captions: string[] = [];

  for (const key of ["og:description", "description", "twitter:description"]) {
    const value = metaContent(html, key);
    if (value) captions.push(value);
  }

  // Instagram and TikTok both stash the post body in inline JSON, under keys
  // that have changed names several times over the years.
  for (const key of [
    "edge_media_to_caption",
    "caption",
    "desc",
    "description",
    "accessibility_caption",
    "text",
  ]) {
    const inline = extractInlineJsonString(html, key);
    if (inline) captions.push(inline);
  }

  return {
    captions,
    author: metaContent(html, "author") ?? metaContent(html, "twitter:creator"),
    thumbnail: metaContent(html, "og:image") ?? metaContent(html, "twitter:image"),
    title: metaContent(html, "og:title") ?? metaContent(html, "twitter:title"),
  };
}

function oembedEndpoint(url: string, platform: SourceType): string | null {
  const encoded = encodeURIComponent(url);
  switch (platform) {
    case "tiktok":
      return `https://www.tiktok.com/oembed?url=${encoded}`;
    case "youtube":
      return `https://www.youtube.com/oembed?url=${encoded}&format=json`;
    default:
      // Instagram's oEmbed needs an app token, so we rely on meta tags there.
      return null;
  }
}

/** Finds `"key": "…"` inside the inline JSON social shells ship with. */
function extractInlineJsonString(html: string, key: string): string | null {
  const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.){40,}?)"`, "g");
  let longest: string | null = null;
  for (const match of html.matchAll(pattern)) {
    try {
      const value = JSON.parse(`"${match[1]}"`) as string;
      if (!longest || value.length > longest.length) longest = value;
    } catch {
      // Not valid JSON string escaping — skip it.
    }
  }
  return longest;
}

function cleanCaption(input: string): string | null {
  let text = decodeEntities(input).replace(/\r\n/g, "\n").trim();

  // Link previews prefix the caption with engagement counts and the handle,
  // e.g. `1,234 likes, 56 comments - someone on May 1, 2025: "real caption"`.
  text = text.replace(
    /^[\d,.]+[KMB]?\s*(?:likes?|views?|comments?|followers?)[\s,]*(?:[\d,.]+[KMB]?\s*(?:likes?|views?|comments?)[\s,]*)*[-–—]?\s*/i,
    "",
  );
  text = text.replace(/^[^:]{0,80}?\son\s\w+\s+\d{1,2},?\s+\d{4}:\s*/i, "");
  text = text.replace(/^[^:]{0,40}?\s*[·|]\s*(?:Instagram|TikTok)[^:]{0,40}:\s*/i, "");
  text = text.replace(/^["“”']+|["“”']+$/g, "").trim();

  // Generic platform boilerplate is not a caption.
  if (/^(instagram|tiktok|watch .{0,40} on (instagram|tiktok)|log in|sign up)\.?$/i.test(text)) {
    return null;
  }

  return text.length > 20 ? text : null;
}

function authorFromUrl(url: string, platform: SourceType): string | null {
  try {
    const { pathname } = new URL(url);
    if (platform === "tiktok") {
      const match = pathname.match(/\/@([^/]+)/);
      return match ? `@${match[1]}` : null;
    }
    if (platform === "instagram") {
      const match = pathname.match(/^\/([^/]+)\/(?:p|reel|tv)\//);
      return match ? `@${match[1]}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function platformLabel(platform: SourceType): string {
  switch (platform) {
    case "instagram": return "Instagram";
    case "tiktok": return "TikTok";
    case "youtube": return "YouTube";
    case "photo": return "Photo";
    case "text": return "Pasted text";
    case "manual": return "Written by you";
    default: return "Web";
  }
}
