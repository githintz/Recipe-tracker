/**
 * Exercises the caption pipeline against the shapes social platforms actually
 * return, with the network stubbed. These are the paths that can't be tested
 * against the live sites — Instagram serves different HTML to everyone — so
 * they're pinned here instead.
 *
 *   node --import tsx scripts/parsers.test.mjs
 */
import assert from "node:assert/strict";
import { fetchSocialPost, detectPlatform } from "../src/lib/extract/social.ts";
import { normalizeUrl } from "../src/lib/extract/fetch.ts";
import { parseIngredientLine } from "../src/lib/quantity.ts";
import { fromText } from "../src/lib/extract/heuristic.ts";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ok    ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`FAILED  ${name}\n        ${error.message}`);
    failed += 1;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ok    ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`FAILED  ${name}\n        ${error.message}`);
    failed += 1;
  }
}

const CAPTION =
  "Miso Butter Noodles\\n\\nIngredients:\\n200g udon\\n3 tbsp butter\\n2 tbsp white miso\\n" +
  "2 cloves garlic\\n\\nMethod:\\n1. Boil the noodles.\\n2. Melt the butter with the miso.\\n" +
  "3. Toss together and serve.";

/** Stubs fetch so a test can decide what each user agent sees. */
function stubFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const ua = init?.headers?.["User-Agent"] ?? "";
    const result = handler(String(url), ua);
    if (result === null) throw new Error("network refused");
    return {
      ok: true,
      status: 200,
      url: String(url),
      headers: { get: () => "text/html; charset=utf-8" },
      text: async () => result,
      json: async () => JSON.parse(result),
    };
  };
  return () => {
    globalThis.fetch = original;
  };
}

const previewPage = (description) => `<!doctype html><html><head>
<meta property="og:title" content="someonecooks on Instagram">
<meta property="og:description" content="${description}">
<meta property="og:image" content="https://example.com/thumb.jpg">
</head><body></body></html>`;

const loginWall = `<!doctype html><html><head><title>Login • Instagram</title></head>
<body><div>Log in to Instagram to see this post</div><script>{"is_logged_in":false}</script></body></html>`;

console.log("URL cleaning\n");

test("strips Instagram's share token", () => {
  const cleaned = normalizeUrl("https://www.instagram.com/reel/Dbr7P3eJ8Og/?stkn=enRsa2p0eHl5M2Fq");
  assert.equal(cleaned, "https://www.instagram.com/reel/Dbr7P3eJ8Og/");
});

test("strips tracking junk but keeps real parameters", () => {
  const cleaned = normalizeUrl("https://example.com/r?utm_source=ig&igsh=abc&page=2");
  assert.equal(cleaned, "https://example.com/r?page=2");
});

test("recognises reel and short links", () => {
  assert.equal(detectPlatform("https://www.instagram.com/reel/abc/"), "instagram");
  assert.equal(detectPlatform("https://vm.tiktok.com/ZMabc/"), "tiktok");
  assert.equal(detectPlatform("https://smittenkitchen.com/x"), "web");
});

console.log("\nCaption extraction\n");

await testAsync("reads a caption out of a link preview", async () => {
  const restore = stubFetch(() => previewPage(CAPTION));
  try {
    const post = await fetchSocialPost("https://www.instagram.com/reel/abc/", "instagram");
    assert.ok(post.caption, `no caption; diagnostics: ${post.diagnostics.join(" | ")}`);
    assert.match(post.caption, /white miso/);
    assert.match(post.caption, /Boil the noodles/);
  } finally {
    restore();
  }
});

await testAsync("strips the likes-and-comments prefix", async () => {
  const restore = stubFetch(() =>
    previewPage(`12,345 likes, 678 comments - someonecooks on May 4, 2025: &quot;${CAPTION}&quot;`),
  );
  try {
    const post = await fetchSocialPost("https://www.instagram.com/reel/abc/", "instagram");
    assert.ok(post.caption.startsWith("Miso Butter Noodles"), `got: ${post.caption.slice(0, 60)}`);
  } finally {
    restore();
  }
});

await testAsync("falls through a sign-in wall to an agent that gets the preview", async () => {
  // The browser agent is shown a wall; the crawler is given the preview.
  const restore = stubFetch((_url, ua) =>
    ua.includes("facebookexternalhit") ? previewPage(CAPTION) : loginWall,
  );
  try {
    const post = await fetchSocialPost("https://www.instagram.com/reel/abc/", "instagram");
    assert.ok(post.caption, `no caption; diagnostics: ${post.diagnostics.join(" | ")}`);
    assert.match(post.caption, /udon/);
  } finally {
    restore();
  }
});

await testAsync("reports what happened when every agent hits a wall", async () => {
  const restore = stubFetch(() => loginWall);
  try {
    const post = await fetchSocialPost("https://www.instagram.com/reel/abc/", "instagram");
    assert.equal(post.caption, null);
    assert.ok(post.diagnostics.length >= 3, "should log every attempt");
    assert.ok(
      post.diagnostics.some((line) => /sign-in wall/.test(line)),
      `diagnostics should name the wall: ${post.diagnostics.join(" | ")}`,
    );
  } finally {
    restore();
  }
});

await testAsync("ignores platform boilerplate that isn't a caption", async () => {
  const restore = stubFetch(() => previewPage("Watch someonecooks on Instagram"));
  try {
    const post = await fetchSocialPost("https://www.instagram.com/reel/abc/", "instagram");
    assert.equal(post.caption, null);
  } finally {
    restore();
  }
});

await testAsync("digs the caption out of inline JSON when meta tags are bare", async () => {
  const restore = stubFetch(
    () => `<!doctype html><html><head><meta property="og:title" content="Instagram"></head>
<body><script>window._data={"caption":${JSON.stringify(CAPTION)}};</script></body></html>`,
  );
  try {
    const post = await fetchSocialPost("https://www.instagram.com/reel/abc/", "instagram");
    assert.ok(post.caption, `no caption; diagnostics: ${post.diagnostics.join(" | ")}`);
    assert.match(post.caption, /miso/i);
  } finally {
    restore();
  }
});

console.log("\nIngredient parsing\n");

for (const [line, expected] of [
  ["1 1/2 cups all-purpose flour, sifted", { quantity: 1.5, unit: "cup", item: "all-purpose flour" }],
  ["½ cup granulated sugar", { quantity: 0.5, unit: "cup", item: "granulated sugar" }],
  ["2-3 tablespoons olive oil", { quantity: 2, unit: "tablespoon", item: "olive oil" }],
  ["200g dried udon noodles", { quantity: 200, unit: "gram", item: "dried udon noodles" }],
  ["2 cloves garlic, finely minced", { quantity: 2, unit: "clove", item: "garlic" }],
]) {
  test(`parses "${line}"`, () => {
    const parsed = parseIngredientLine(line);
    assert.equal(parsed.quantity, expected.quantity);
    assert.equal(parsed.unit, expected.unit);
    assert.equal(parsed.item, expected.item);
  });
}

test("keeps an unmeasurable line whole", () => {
  const parsed = parseIngredientLine("Salt and pepper to taste");
  assert.equal(parsed.quantity, null);
  assert.equal(parsed.item, "Salt and pepper to taste");
});

console.log("\nHeuristic caption parsing\n");

test("splits a caption into ingredients and method", () => {
  const parsed = fromText(CAPTION.replace(/\\n/g, "\n"));
  assert.equal(parsed.title, "Miso Butter Noodles");
  assert.equal(parsed.ingredients.length, 4);
  assert.equal(parsed.steps.length, 3);
});

console.log(
  `\n${passed} passed, ${failed} failed.`,
);
process.exit(failed === 0 ? 0 : 1);
