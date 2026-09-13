/**
 * Fills an empty database with a few recipes so a fresh checkout has something
 * to look at. Safe to re-run: it does nothing if any recipes already exist.
 *
 *   node scripts/seed.mjs
 */
import { createRecipe, createFolder, listRecipes, setRecipeFolders } from "../src/lib/db.ts";
import { parseIngredientLine } from "../src/lib/quantity.ts";
import { estimateNutrition } from "../src/lib/nutrition.ts";

const RECIPES = [
  {
    title: "Miso Butter Noodles",
    description:
      "A ten-minute bowl built from things that keep: miso, butter, and whatever noodles are in the cupboard.",
    sourceType: "instagram",
    sourceName: "Instagram",
    author: "@weeknightbowl",
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 10,
    tags: ["weeknight", "noodles", "vegetarian"],
    ingredients: [
      "200 g dried udon noodles",
      "3 tbsp unsalted butter",
      "2 tbsp white miso paste",
      "2 cloves garlic, finely grated",
      "1 tsp soy sauce",
      "2 spring onions, thinly sliced",
      "1 tsp toasted sesame seeds",
    ],
    steps: [
      "Bring a large pot of water to the boil and cook the noodles to the packet timing.",
      "While they cook, melt the butter in a wide pan over a low heat. Stir in the miso and garlic and cook for 1 minute, until it smells nutty but hasn't caught.",
      "Lift the noodles straight into the pan with tongs, bringing a splash of cooking water with them. Toss hard for 30 seconds until the sauce clings.",
      "Add the soy sauce, taste, and loosen with more noodle water if it looks tight.",
      "Divide between bowls and finish with the spring onions and sesame seeds.",
    ],
    notes: "White miso is sweeter and gentler than red. If you only have red, start with 1 tbsp.",
  },
  {
    title: "Sheet Pan Harissa Chicken",
    description:
      "Everything roasts on one tray: the chickpeas crisp, the lemon softens, and the pan juices become the sauce.",
    sourceType: "web",
    sourceName: "ladle.example",
    author: null,
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 40,
    tags: ["one pan", "chicken", "dinner"],
    ingredients: [
      "For the tray:",
      "8 chicken thighs, bone in and skin on",
      "1 can chickpeas, drained and rinsed",
      "2 red onions, cut into wedges",
      "1 lemon, thinly sliced",
      "3 tbsp olive oil",
      "For the rub:",
      "3 tbsp rose harissa",
      "1 tsp ground cumin",
      "1 tsp salt",
    ],
    steps: [
      "Heat the oven to 200°C.",
      "Mix the harissa, cumin, salt and 2 tbsp of the oil in a large bowl. Add the chicken and turn it until every piece is coated.",
      "Tip the chickpeas, onions and lemon onto a large baking tray, toss with the last of the oil, and spread them out.",
      "Nestle the chicken on top, skin side up, leaving space between the pieces so they roast rather than steam.",
      "Roast for 40 minutes, until the skin is dark in patches and the juices run clear.",
      "Rest for 5 minutes, then spoon the pan juices back over everything before serving.",
    ],
    notes: "Swap the chickpeas for halved new potatoes — they want an extra 10 minutes, so start them first.",
  },
  {
    title: "Brown Butter Banana Bread",
    description:
      "Browning the butter first is the whole trick: it takes four minutes and tastes like it took an afternoon.",
    sourceType: "tiktok",
    sourceName: "TikTok",
    author: "@slowsundaybakes",
    servings: 10,
    servingsNoun: "slices",
    prepMinutes: 15,
    cookMinutes: 60,
    tags: ["baking", "breakfast"],
    ingredients: [
      "115 g unsalted butter",
      "3 very ripe bananas, mashed",
      "150 g brown sugar",
      "2 eggs",
      "1 tsp vanilla extract",
      "190 g all-purpose flour",
      "1 tsp baking soda",
      "0.5 tsp salt",
    ],
    steps: [
      "Heat the oven to 175°C and line a loaf tin.",
      "Melt the butter in a light-coloured pan over a medium heat, swirling, until the milk solids at the bottom turn golden and it smells like toffee — about 4 minutes. Pour it into a bowl and let it cool for 5 minutes.",
      "Whisk the sugar into the butter, then the eggs one at a time, then the bananas and vanilla.",
      "Fold in the flour, baking soda and salt, stopping the moment the flour disappears.",
      "Pour into the tin and bake for 55 to 60 minutes, until a skewer comes out with a few damp crumbs.",
      "Cool in the tin for 10 minutes before turning out.",
    ],
    notes: "The blacker the bananas, the better. Freeze overripe ones and thaw them straight into the bowl.",
  },
];

function build(entry) {
  const ingredients = [];
  let group = null;
  for (const line of entry.ingredients) {
    if (line.endsWith(":")) {
      group = line.slice(0, -1);
      continue;
    }
    ingredients.push(parseIngredientLine(line, group));
  }

  const steps = entry.steps.map((text) => ({ text, group: null }));
  const servings = entry.servings ?? null;

  return {
    title: entry.title,
    description: entry.description,
    imageUrl: null,
    sourceUrl: null,
    sourceName: entry.sourceName,
    author: entry.author ?? null,
    sourceType: entry.sourceType,
    servings,
    servingsNoun: entry.servingsNoun ?? "servings",
    prepMinutes: entry.prepMinutes ?? null,
    cookMinutes: entry.cookMinutes ?? null,
    totalMinutes: (entry.prepMinutes ?? 0) + (entry.cookMinutes ?? 0) || null,
    ingredients,
    steps,
    notes: entry.notes ?? null,
    tags: entry.tags ?? [],
    nutrition: estimateNutrition(ingredients, servings),
    extractedBy: "manual",
    warnings: [],
  };
}

if (listRecipes().length > 0) {
  console.log("Database already has recipes — nothing to seed.");
} else {
  const weeknights = createFolder("Weeknight dinners", "🍝");
  const baking = createFolder("Baking", "🍰");

  for (const entry of RECIPES) {
    const recipe = createRecipe(build(entry));
    const folder = entry.tags.includes("baking") ? baking : weeknights;
    setRecipeFolders(recipe.id, [folder.id]);
    console.log(`Added: ${recipe.title}`);
  }
  console.log("\nSeeded. Run `npm run dev` and open http://localhost:3000");
}
