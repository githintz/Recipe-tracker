/**
 * Page fetching for imports. Recipe sites and social platforms are picky about
 * who they serve, so the caller picks how to present itself, and every response
 * carries enough detail to explain a failure rather than just reporting one.
 */

/** What a normal desktop browser sends. Best for ordinary recipe sites. */
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Social platforms build their pages in the browser and show a sign-in wall to
 * anyone who isn't logged in — but they still hand a link preview to the
 * crawlers that build those previews, and that preview contains the caption.
 * Asking as a crawler is how a logged-out reader gets the recipe.
 */
export const CRAWLER_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

export const BOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const MAX_BYTES = 4_000_000;
const TIMEOUT_MS = 20_000;

export type PageResult = {
  html: string;
  status: number;
  finalUrl: string;
  contentType: string;
  /** Which user agent produced this response. */
  userAgent: string;
};

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export async function fetchPage(
  url: string,
  options: { userAgent?: string } = {},
): Promise<PageResult> {
  const userAgent = options.userAgent ?? BROWSER_UA;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new FetchError(
        `The page returned ${response.status} ${response.statusText}.`,
        response.status,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    // Some hosts omit the header entirely; that's not a reason to give up.
    if (contentType && !/text\/html|application\/(xhtml|json|ld\+json)|text\/plain/i.test(contentType)) {
      throw new FetchError(`That link is ${contentType}, not a recipe page.`);
    }

    const body = await response.text();
    return {
      html: body.length > MAX_BYTES ? body.slice(0, MAX_BYTES) : body,
      status: response.status,
      finalUrl: response.url || url,
      contentType,
      userAgent,
    };
  } catch (error) {
    if (error instanceof FetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new FetchError("The site took too long to respond.");
    }
    throw new FetchError(
      error instanceof Error ? error.message : "Could not reach that link.",
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort oEmbed lookup — gives us a caption when the HTML is a shell. */
export async function fetchOEmbed(
  endpoint: string,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { "User-Agent": CRAWLER_UA, Accept: "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parameters that identify the sharer or the share session rather than the
 * post. Instagram's `stkn` share token is the important one: carrying it can
 * send the request somewhere other than the post itself.
 */
const JUNK_PARAMS =
  /^(utm_|fbclid|gclid|igshid|igsh|stkn|share_id|shared_by|_r$|_t$|_nc_|si$|feature$|app$|is_from_webapp$|sender_device$|web_id$)/i;

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);

  for (const key of [...url.searchParams.keys()]) {
    if (JUNK_PARAMS.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
