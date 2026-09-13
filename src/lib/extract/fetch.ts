/**
 * Page fetching for imports. Recipe sites and social platforms are picky about
 * who they serve, so we present as a normal browser, cap the response size and
 * always time out rather than hanging an import request.
 */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const MAX_BYTES = 4_000_000;
const TIMEOUT_MS = 15_000;

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
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

    const type = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/(xhtml|json|ld\+json)|text\/plain/i.test(type)) {
      throw new FetchError(`That link is ${type || "not a web page"}, not a recipe page.`);
    }

    const body = await response.text();
    return body.length > MAX_BYTES ? body.slice(0, MAX_BYTES) : body;
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
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);

  // Tracking parameters change nothing about the recipe but break dedupe.
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|igshid|igsh|_r$|_t$|si$)/i.test(key)) {
      url.searchParams.delete(key);
    }
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
