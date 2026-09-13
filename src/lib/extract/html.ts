const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–",
  mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  hellip: "…", frac12: "½", frac14: "¼", frac34: "¾", deg: "°", eacute: "é",
  egrave: "è", agrave: "à", ccedil: "ç", ouml: "ö", uuml: "ü", auml: "ä",
  szlig: "ß", ntilde: "ñ", iacute: "í", oacute: "ó", aacute: "á", uacute: "ú",
  middot: "·", bull: "•", times: "×", divide: "÷", trade: "™", copy: "©",
  reg: "®", euro: "€", pound: "£", yen: "¥", cent: "¢",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z][a-z0-9]*);/gi, (match, name: string) => {
      const lower = name.toLowerCase();
      return lower in ENTITIES ? ENTITIES[lower] : match;
    });
}

/** Strips tags to readable text, turning block elements into line breaks. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/** Reads a <meta> value by property or name, whichever the page used. */
export function metaContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*\\scontent\\s*=\\s*["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*\\s(?:property|name)\\s*=\\s*["']${escaped}["']`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]).trim();
  }
  return null;
}

export function pageTitle(html: string): string | null {
  const og = metaContent(html, "og:title");
  if (og) return og;
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1]).trim() : null;
}

/** Pulls every JSON-LD block out of a page, tolerating malformed ones. */
export function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern =
    /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    const body = match[1].trim().replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
    try {
      blocks.push(JSON.parse(body));
    } catch {
      // Some sites emit trailing commas or stray newlines; try a light repair.
      try {
        blocks.push(JSON.parse(body.replace(/,\s*([}\]])/g, "$1")));
      } catch {
        // Give up on this block — other blocks may still parse.
      }
    }
  }
  return blocks;
}
