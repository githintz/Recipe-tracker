/**
 * Boots the built app and checks that it actually works: every page renders,
 * the API round-trips a recipe, the offline import parser reads a caption, and
 * the grocery list merges duplicate lines.
 *
 * Runs against a throwaway database so it never touches your saved recipes.
 *
 *   npm run build && node scripts/smoke.mjs
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = process.env.SMOKE_PORT ?? "3210";
const BASE = `http://127.0.0.1:${PORT}`;
const dbDir = mkdtempSync(path.join(tmpdir(), "ladle-smoke-"));

let failures = 0;
let server;

function check(name, passed, detail = "") {
  const mark = passed ? "  ok  " : "FAILED";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures += 1;
}

/** True when nothing is listening on the port yet. */
function portIsFree(port) {
  return new Promise((resolve) => {
    const probe = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => probe.close(() => resolve(true)))
      .listen(port, "127.0.0.1");
  });
}

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return true;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function main() {
  if (!(await portIsFree(Number(PORT)))) {
    console.error(
      `Port ${PORT} is already in use. Something else is listening there, and ` +
        `testing against it would give meaningless results. Free the port, or ` +
        `set SMOKE_PORT to another one.`,
    );
    process.exit(1);
  }

  // `npx` shells out, so killing it leaves the real server orphaned. Detaching
  // puts the whole tree in its own process group that we can signal at once.
  server = spawn("npx", ["next", "start", "-p", PORT], {
    detached: true,
    env: {
      ...process.env,
      LADLE_DB_PATH: path.join(dbDir, "smoke.db"),
      // The offline parsers must carry the suite on their own, so CI doesn't
      // depend on a key or make paid calls.
      ANTHROPIC_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverLog = "";
  server.stdout.on("data", (chunk) => (serverLog += chunk));
  server.stderr.on("data", (chunk) => (serverLog += chunk));

  if (!(await waitForServer())) {
    console.error("Server never became ready. Output:\n" + serverLog);
    process.exit(1);
  }
  console.log(`Server up on ${BASE}\n`);

  // ---------------------------------------------------------------- pages
  for (const [name, url] of [
    ["home", "/"],
    ["import", "/import"],
    ["folders", "/folders"],
    ["grocery", "/grocery"],
    ["missing recipe 404", "/recipes/does-not-exist"],
  ]) {
    const response = await fetch(BASE + url);
    const expected = name.includes("404") ? 404 : 200;
    check(`page ${name}`, response.status === expected, `got ${response.status}`);
  }

  // ------------------------------------------------------------ import API
  const caption = `Creamy Tomato Orzo

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

  const importResponse = await fetch(`${BASE}/api/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "text", text: caption }),
  });
  const imported = await importResponse.json();
  const draft = imported.recipe;

  check("import parses a caption", importResponse.ok && Boolean(draft), imported.error ?? "");
  if (draft) {
    check("  title read", draft.title === "Creamy Tomato Orzo", draft.title);
    check("  ingredients found", draft.ingredients.length === 5, `${draft.ingredients.length}`);
    check("  steps found", draft.steps.length === 3, `${draft.steps.length}`);
    check("  tags found", draft.tags.includes("pasta"), JSON.stringify(draft.tags));
    const orzo = draft.ingredients.find((i) => i.item.includes("orzo"));
    check("  amounts parsed", orzo?.quantity === 300 && orzo?.unit === "gram", JSON.stringify(orzo));
  }

  // Empty input is a malformed request; text that simply isn't a recipe is a
  // well-formed request we can't process — those are different status codes.
  const emptyStatus = (
    await fetch(`${BASE}/api/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "text", text: "   " }),
    })
  ).status;
  check("import rejects empty input", emptyStatus === 400, `got ${emptyStatus}`);

  const junk = await fetch(`${BASE}/api/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "text", text: "hi" }),
  });
  const junkBody = await junk.json();
  check("import rejects non-recipe text", junk.status === 422, `got ${junk.status}`);
  check("  and explains why", Boolean(junkBody.error), junkBody.error ?? "");

  // ----------------------------------------------------------- recipe CRUD
  const created = await (
    await fetch(`${BASE}/api/recipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
  ).json();
  const recipe = created.recipe;
  check("recipe saved", Boolean(recipe?.id));

  if (recipe) {
    check("recipe page renders", (await fetch(`${BASE}/recipes/${recipe.id}`)).status === 200);
    check("cook mode renders", (await fetch(`${BASE}/recipes/${recipe.id}/cook`)).status === 200);
    check("edit page renders", (await fetch(`${BASE}/recipes/${recipe.id}/edit`)).status === 200);

    const patched = await (
      await fetch(`${BASE}/api/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: true }),
      })
    ).json();
    check("recipe updates", patched.recipe?.favorite === true);

    const search = await (await fetch(`${BASE}/api/recipes?q=orzo`)).json();
    check("search finds it by ingredient", search.recipes.length === 1, `${search.recipes.length}`);
  }

  // --------------------------------------------------------------- folders
  const folder = (
    await (
      await fetch(`${BASE}/api/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Weeknights", emoji: "🍝" }),
      })
    ).json()
  ).folder;
  check("folder created", Boolean(folder?.id));

  if (folder && recipe) {
    await fetch(`${BASE}/api/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderIds: [folder.id] }),
    });
    const inFolder = await (await fetch(`${BASE}/api/recipes?folder=${folder.id}`)).json();
    check("recipe filed in folder", inFolder.recipes.length === 1, `${inFolder.recipes.length}`);
    check("folder page renders", (await fetch(`${BASE}/folders/${folder.id}`)).status === 200);
  }

  // --------------------------------------------------------- grocery merge
  if (recipe) {
    const first = await (
      await fetch(`${BASE}/api/recipes/${recipe.id}/grocery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factor: 1 }),
      })
    ).json();
    check("ingredients added to list", first.added === 5, JSON.stringify(first));

    // Adding the same recipe again should merge every line, not duplicate it.
    const second = await (
      await fetch(`${BASE}/api/recipes/${recipe.id}/grocery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factor: 1 }),
      })
    ).json();
    check("second add merges", second.added === 0 && second.merged === 5, JSON.stringify(second));

    await fetch(`${BASE}/api/grocery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "3 lemons" }),
    });

    const list = (await (await fetch(`${BASE}/api/grocery`)).json()).items;
    const lemons = list.find((item) => item.item.includes("lemon"));
    check("plural lines merge", lemons?.quantity === 7, JSON.stringify(lemons));
    check("aisles assigned", lemons?.aisle === "Produce", lemons?.aisle);

    const oil = list.find((item) => item.item.includes("olive oil"));
    check("units preserved", oil?.unit === "tablespoon" && oil?.quantity === 2, JSON.stringify(oil));
  }

  // -------------------------------------------------------------- teardown
  if (recipe) {
    check(
      "recipe deletes",
      (await fetch(`${BASE}/api/recipes/${recipe.id}`, { method: "DELETE" })).ok,
    );
    check("deleted recipe 404s", (await fetch(`${BASE}/recipes/${recipe.id}`)).status === 404);
  }

  console.log(
    failures === 0 ? "\nAll smoke checks passed." : `\n${failures} smoke check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

function cleanup() {
  if (server?.pid) {
    try {
      // Negative pid signals the whole group, not just the npx wrapper.
      process.kill(-server.pid, "SIGKILL");
    } catch {
      server.kill("SIGKILL");
    }
  }
  try {
    rmSync(dbDir, { recursive: true, force: true });
  } catch {
    // Best effort — it's a temp directory.
  }
}

process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(130));

main().catch((error) => {
  console.error("Smoke run crashed:", error);
  process.exit(1);
});
