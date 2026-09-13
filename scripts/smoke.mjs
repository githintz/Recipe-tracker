/**
 * Drives the exported app in a real browser: types a recipe in, saves it to
 * on-device storage, reads it back, and builds a grocery list from it.
 *
 * This is the closest thing to running the APK that works without a device —
 * the WebView runs the same exported files against the same IndexedDB store.
 *
 *   npm run build && node scripts/smoke.mjs
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve("out");
const PORT = Number(process.env.SMOKE_PORT ?? 4321);
const BASE = `http://127.0.0.1:${PORT}`;

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".ico": "image/x-icon", ".txt": "text/plain", ".webmanifest": "application/manifest+json",
};

let failures = 0;
function check(name, passed, detail = "") {
  console.log(`${passed ? "  ok  " : "FAILED"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures += 1;
}

/** Serves the exported files the way the WebView does: plain files, no server logic. */
function serve() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, BASE);
      let filePath = path.join(OUT, decodeURIComponent(url.pathname));

      const found = await stat(filePath).catch(() => null);
      if (found?.isDirectory()) filePath = path.join(filePath, "index.html");
      else if (!found) filePath = `${filePath}.html`;

      const body = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(filePath)] ?? "application/octet-stream",
      });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
}

const RECIPE_TEXT = `Creamy Tomato Orzo

Ingredients:
- 1 tbsp olive oil
- 1 onion, diced
- 300 g orzo
- 400 ml chicken stock
- 2 lemons, juiced

Instructions:
1. Heat the oil and soften the onion for 5 minutes.
2. Add the orzo and stock, simmer 12 minutes until tender.
3. Stir through cream and serve.

#pasta #weeknight`;

const server = serve();
let browser;

try {
  await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  console.log(`Serving the export on ${BASE}\n`);

  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  // ----------------------------------------------------------- every screen
  for (const [name, route] of [
    ["home", "/"],
    ["import", "/import/"],
    ["folders", "/folders/"],
    ["grocery", "/grocery/"],
    ["settings", "/settings/"],
  ]) {
    const response = await page.goto(BASE + route, { waitUntil: "networkidle" });
    check(`${name} renders`, response?.status() === 200, `HTTP ${response?.status()}`);
  }

  // --------------------------------------------------------- import a recipe
  await page.goto(`${BASE}/import/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Paste text/i }).click();
  await page.getByLabel("Recipe text").fill(RECIPE_TEXT);
  await page.getByRole("button", { name: "Import recipe" }).click();

  await page.getByLabel("Title").waitFor({ timeout: 20_000 });
  check("caption parsed into the editor", true);
  check(
    "  title read",
    (await page.getByLabel("Title").inputValue()) === "Creamy Tomato Orzo",
    await page.getByLabel("Title").inputValue(),
  );

  const ingredientText = await page.getByLabel(/^Ingredients/).inputValue();
  check("  ingredients found", ingredientText.split("\n").filter(Boolean).length === 5);
  check("  amounts kept", ingredientText.includes("300 g orzo"), ingredientText.split("\n")[2]);

  const methodText = await page.getByLabel("Method").inputValue();
  check("  steps found", methodText.split("\n").filter(Boolean).length === 3);

  // ------------------------------------------------------ save and read back
  await page.getByRole("button", { name: "Save to recipe box" }).click();
  await page.waitForURL(/\/recipe\/\?id=/, { timeout: 15_000 });
  check("recipe saved to the device", true, page.url().split("?")[1]);

  await page.getByRole("heading", { name: "Creamy Tomato Orzo" }).waitFor();
  check("reader shows the recipe", true);

  await page.getByRole("button", { name: "Directions" }).click();
  check(
    "directions tab lists the method",
    await page.getByText("soften the onion").first().isVisible(),
  );

  // Persistence is the whole point of an offline app: reload and it's still here.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByText("Creamy Tomato Orzo").first().waitFor({ timeout: 10_000 });
  check("recipe survives a reload", true);

  // ----------------------------------------------------------- grocery merge
  const recipeUrl = await page
    .getByRole("link", { name: /Creamy Tomato Orzo/ })
    .first()
    .getAttribute("href");
  await page.goto(BASE + recipeUrl.replace(/^\//, "/"), { waitUntil: "networkidle" });

  for (let i = 0; i < 2; i += 1) {
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Add to grocery list" }).click();
    await page.waitForTimeout(400);
  }

  await page.goto(`${BASE}/grocery/`, { waitUntil: "networkidle" });
  await page.getByText("Produce").first().waitFor({ timeout: 10_000 });

  // Added twice, so every line should have doubled rather than duplicated.
  check(
    "adding twice merges instead of duplicating",
    await page.getByText("4 lemons").first().isVisible(),
  );
  check(
    "amounts are summed",
    await page.getByText("2 tbsp").first().isVisible(),
  );
  check(
    "grouped by aisle",
    (await page.getByText("Produce").count()) > 0 && (await page.getByText("Pantry").count()) > 0,
  );

  check("no uncaught page errors", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (error) {
  console.error("\nSmoke run crashed:", error);
  failures += 1;
} finally {
  await browser?.close();
  server.close();
}

console.log(failures === 0 ? "\nAll smoke checks passed." : `\n${failures} smoke check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
