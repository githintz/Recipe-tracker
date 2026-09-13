# Ladle

[![CI](https://github.com/githintz/Recipe-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/githintz/Recipe-tracker/actions/workflows/ci.yml)

An offline Android app that saves recipes from Instagram, TikTok, YouTube and
any website, and reads them back in a format you can cook from — no ads, no
autoplay video, no three pages of preamble before the ingredients.

No account, no subscription, no server. Your recipes live in the app's own
storage on your phone.

## Getting the APK

Every CI run builds one. Open the
[Actions tab](https://github.com/githintz/Recipe-tracker/actions/workflows/ci.yml),
click the most recent green run, and download **`ladle-apk`** from the
Artifacts section at the bottom. Unzip it and copy the `.apk` to your phone.

It's a **debug build**, so Android will warn you it's from an unknown source —
you'll need to allow installation from your browser or file manager. That's
expected for an app you build yourself rather than install from Play.

Building it yourself needs the Android SDK and a JDK:

```bash
npm install
npm run apk          # → android/app/build/outputs/apk/debug/app-debug.apk
```

## What it does

**Getting recipes in**

| Path | How it works |
|---|---|
| Share sheet | Share a post from Instagram or TikTok straight into Ladle |
| Paste a link | Any post or recipe site |
| Clipboard prompt | One tap on the home screen reads a copied link |
| Paste text | A caption, an email, a note from a friend |
| Scan a photo | A cookbook page, a recipe card, a screenshot |
| Write it yourself | Family recipes and the ones in your head |

**Reading and cooking**

- A clean reader: hero image, times, ingredients, method — nothing else
- Scale by servings, with fraction-aware amounts (`1½` stays `1½`)
- Convert between metric and US cups
- Cook mode: one step at a time, large type, a screen wake lock so the phone
  doesn't sleep, a tap-away ingredient list, and timers pulled out of the step
  text ("simmer for 20 minutes" gives you a 20-minute timer)
- Nutrition per serving, from the source or estimated

**Organising**

- Search across titles, descriptions, tags and ingredients
- Folders, favourites and tags — a recipe can sit in as many folders as you like
- A grocery list grouped by supermarket aisle that merges repeats: two recipes
  that each want butter give you one line, and "2 lemons" tops up "1 lemon"

**Moving your data**

- Back up everything to a JSON file, and restore it on another phone
- Copy or share a recipe as plain text, scaled to the batch you're cooking

## The import pipeline

A link goes through four strategies, stopping at the first that produces a real
ingredient list:

1. **schema.org JSON-LD** — what most recipe sites publish. Exact, and needs no
   AI at all.
2. **Microdata** — the older markup, still used by long-running food blogs.
3. **Social captions** — Instagram and TikTok build their captions in the
   browser, so the served HTML is a shell. Ladle pulls the caption from Open
   Graph tags, the platform's oEmbed endpoint, and the inline JSON in the shell,
   then takes the longest result, because a truncated caption loses the method.
4. **Claude** (`claude-opus-5`) — reads free-form text and photos into a
   structured recipe, when there's nothing machine-readable to parse.

Steps 1–3 need no API key. Add one in **Settings** for step 4 and for photo
scanning.

### What it can't do

If a creator only *says* the recipe out loud in a video and never writes it
down, it isn't in the page to read, and no amount of parsing will find it.
Ladle tells you that rather than inventing quantities. Same for private and
age-restricted posts.

The extractor is also instructed never to guess: if a source gives no oven
temperature, you get a blank and a warning, not a plausible number.

## How it's built

The UI is a Next.js static export — plain HTML, CSS and JavaScript with no
server behind it — wrapped in a Capacitor WebView for Android.

Two things make that work:

- **Storage is IndexedDB**, in the app's private sandbox. A native SQLite plugin
  would also work, but IndexedDB needs no native module and a personal recipe
  box is small enough to filter in JavaScript instantly.
- **Imports use Capacitor's native HTTP.** A WebView origin asking
  instagram.com for a page would be refused by CORS, and recipe sites send no
  access-control headers to anyone. Routing the fetch through the native stack
  sidesteps the browser's rules entirely — which is the whole reason this can be
  an app and not a website.

```
src/
  app/            Screens (all client-side; static export has no server)
  components/     UI
  lib/
    store.ts      IndexedDB: recipes, folders, grocery list
    settings.ts   API key and per-device preferences
    quantity.ts   Ingredient parsing, fractions, scaling
    units.ts      Metric / US conversion
    aisle.ts      Ingredient → supermarket aisle
    nutrition.ts  Rough per-serving estimate
    extract/      The import pipeline
android/          Capacitor Android project
scripts/smoke.mjs Drives the exported app in a real browser
```

## Checks

```bash
npm run verify     # typecheck, lint, build, smoke
```

| Command | What it does |
|---|---|
| `npm run dev` | Run the UI in a browser (imports will hit CORS — see above) |
| `npm run build` | Static export to `out/` |
| `npm run smoke` | Drives the exported app in Chromium |
| `npm run sync:android` | Build and copy the UI into the Android project |
| `npm run apk` | Build the debug APK |

`npm run smoke` is the one that matters. It serves the export the way the
WebView does and drives it: types a recipe in, saves it, reloads the page to
prove it persisted, opens the reader, and builds a grocery list — checking that
adding the same recipe twice merges the lines instead of duplicating them. It
needs no API key, so it never makes a paid call.

## A note on the API key

There is no server, so the Claude key lives on the device. It sits in the app's
private storage, which other apps can't read on a normal device — but anyone
with your unlocked phone can find it, and calls are billed to your account. Use
a key you're willing to rotate, and don't hand someone a build with your key in
it.

Everything else works without a key.

## Notes

- The nutrition estimate comes from a short ingredient table. Good enough to
  compare two recipes, not good enough to count on; it's labelled as an estimate
  wherever it appears.
- Uninstalling the app deletes your recipes with it. Back up first.
- Creator avatars are drawn from the name — social platforms don't hand out
  profile pictures to third parties.

Ladle is an independent project, not affiliated with any other recipe app or
with the platforms it imports from.
