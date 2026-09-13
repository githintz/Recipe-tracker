import type { SourceType } from "../types";
import { decodeEntities, metaContent } from "./html";
import { fetchOEmbed } from "./fetch";

export type SocialPost = {
  platform: SourceType;
  /** The post caption, which is where the recipe usually lives. */
  caption: string | null;
  author: string | null;
  thumbnail: string | null;
  title: string | null;
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

/**
 * Social pages render their caption client-side, so the served HTML is mostly a
 * shell. Three places still carry the caption: Open Graph meta tags, the
 * platform's oEmbed endpoint, and inline JSON in the shell. We try all of them
 * and take the longest result, since a truncated caption loses the method.
 */
export async function fetchSocialPost(
  url: string,
  html: string,
  platform: SourceType,
): Promise<SocialPost> {
  const candidates: string[] = [];

  const ogDescription = metaContent(html, "og:description");
  if (ogDescription) candidates.push(ogDescription);

  const description = metaContent(html, "description");
  if (description) candidates.push(description);

  for (const key of ["edge_media_to_caption", "desc", "description"]) {
    const inline = extractInlineJsonString(html, key);
    if (inline) candidates.push(inline);
  }

  let author = metaContent(html, "author") ?? null;
  let thumbnail = metaContent(html, "og:image");
  const title = metaContent(html, "og:title");

  const oembedUrl = oembedEndpoint(url, platform);
  if (oembedUrl) {
    const data = await fetchOEmbed(oembedUrl);
    if (data) {
      const fields = ["title", "description", "caption"] as const;
      for (const field of fields) {
        const value = data[field];
        if (typeof value === "string" && value.trim()) candidates.push(value);
      }
      if (typeof data.author_name === "string") author ??= data.author_name;
      if (typeof data.thumbnail_url === "string") thumbnail ??= data.thumbnail_url;
    }
  }

  const caption = candidates
    .map((c) => cleanCaption(c))
    .filter(Boolean)
    .sort((a, b) => b!.length - a!.length)[0] ?? null;

  if (!author) author = authorFromUrl(url, platform);

  return { platform, caption, author, thumbnail: thumbnail ?? null, title };
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

/** Finds `"key": "...."` inside the inline JSON social shells ship with. */
function extractInlineJsonString(html: string, key: string): string | null {
  const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.){40,})"`, "g");
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

  // Platforms prefix captions with engagement counts and the handle.
  text = text.replace(
    /^[\d,.]+[KMB]?\s*(?:likes?|views?|comments?)[\s,]*[\d,.]*[KMB]?\s*(?:likes?|views?|comments?)?[\s,-]*/i,
    "",
  );
  text = text.replace(/^[^:]{0,60}\son\s\w+\s+\d{1,2},?\s+\d{4}:\s*/i, "");
  text = text.replace(/^["“”']+|["“”']+$/g, "").trim();

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
