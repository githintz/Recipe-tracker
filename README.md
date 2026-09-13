# Ladle

[![CI](https://github.com/githintz/Recipe-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/githintz/Recipe-tracker/actions/workflows/ci.yml)

Save recipes from Instagram, TikTok, YouTube and any website, and read them back
in a format you can actually cook from — no ads, no autoplay video, no three
pages of preamble before the ingredients.

Everything is free. There is no paywall, no subscription, no account, and no
analytics. Your recipes live in a SQLite file on your own machine.

## What it does

**Import, eight ways in from four screens**

| Path | How it works |
|---|---|
| Paste a link | Instagram, TikTok, YouTube or any recipe site |
| Clipboard prompt | One tap on the home screen reads a copied link |
| Share sheet | Installed as a PWA, Ladle appears as a share target |
| Paste text | A caption, an email, a note from a friend |
| Scan a photo | A cookbook page, a recipe card, a screenshot |
| Write it yourself | Family recipes and the ones in your head |

**Read and cook**

- A clean reader: hero image, times, ingredients, method — and nothing else
- Scale a recipe by servings, with fraction-aware amounts (`1½` stays `1½`)
- Convert between metric and US cups
- Cook mode: one step at a time, large type, a screen wake lock so the phone
  doesn't sleep, a tap-away ingredient list, and timers pulled out of the step
  text ("simmer for 20 minutes" gives you a 20-minute timer)
- Nutrition per serving, either from the source or estimated

**Organise**

- Search across titles, descriptions, tags and ingredients
- Folders, favourites and tags — a recipe can sit in as many folders as you like
- A grocery list grouped by supermarket aisle, which merges repeats: add two
  recipes that each want butter and you get one line

**Share**

- Copy or share a recipe as plain text, scaled to the batch you're cooking
- Print a clean page
- Export the whole database — it's a single SQLite file

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

Optional but recommended:

```bash
cp .env.example .env
# add your key to .env
```

To load a few recipes so the app isn't empty on first run:

```bash
npx tsx scripts/seed.mjs
```

## Checks

```bash
npm run verify     # typecheck, lint, build, smoke
```

Or individually:

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config) |
| `npm run build` | Production build |
| `npm run smoke` | Boots the built app and exercises it |

`npm run smoke` is the one that matters. It starts the built server against a
throwaway database — never your real one — and checks that every page renders,
the import parser reads a caption into structured fields, recipes round-trip
through the API, folders file correctly, and the grocery list merges duplicate
lines instead of stacking them. It runs with no API key, so the offline parsers
have to carry it and CI never makes a paid call.

GitHub Actions runs all four on every push and pull request, against Node 20
and 22.

## The import pipeline

A recipe link goes through four strategies, in order, stopping at the first that
produces a real ingredient list:

1. **schema.org JSON-LD** — what most recipe sites publish. Exact, and needs no
   AI at all.
2. **Microdata** — the older markup, still used by long-running food blogs.
3. **Social captions** — Instagram and TikTok render their captions client-side,
   so the served HTML is a shell. Ladle pulls the caption from Open Graph tags,
   the platform's oEmbed endpoint, and the inline JSON in the shell, then takes
   the longest result, because a truncated caption loses the method.
4. **Claude** (`claude-opus-5`) — reads free-form text and photos into a
   structured recipe. Used when there's nothing machine-readable to parse.

Without `ANTHROPIC_API_KEY` set, steps 1–3 still work and a built-in heuristic
parser handles step 4. It gets the common caption shapes right — explicit
`Ingredients:` / `Instructions:` headings, numbered steps, `2 cups flour` lines —
but not every one. Photo scanning needs the key.

### What it can't do

If a creator only *says* the recipe out loud in a video and never writes it
down, it isn't in the page to read, and no amount of parsing will find it.
Ladle tells you that rather than inventing quantities. The same goes for private
and age-restricted posts.

The extractor is also instructed never to guess: if a source doesn't give an
oven temperature, you get a blank and a warning, not a plausible number.

## Layout

```
src/
  app/            Routes and API handlers
  components/     UI
  lib/
    db.ts         SQLite store
    quantity.ts   Ingredient parsing, fractions, scaling
    units.ts      Metric / US conversion
    aisle.ts      Ingredient → supermarket aisle
    nutrition.ts  Rough per-serving estimate
    extract/      The import pipeline
scripts/seed.mjs  Sample data
```

Next.js (App Router) · TypeScript · SQLite · Tailwind.

## Notes

- The nutrition estimate comes from a short ingredient table. It's good enough
  to compare two recipes and not good enough to count on; it's labelled as an
  estimate wherever it appears.
- The clipboard prompt can only read the clipboard on a user gesture, and some
  browsers refuse entirely. It falls back to a paste field.
- Creator avatars are drawn from the name — social platforms don't hand out
  profile pictures to third parties.

Ladle is an independent project, not affiliated with any other recipe app or
with the platforms it imports from.
