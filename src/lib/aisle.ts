/**
 * Maps an ingredient to a supermarket section so the grocery list is sorted
 * the way you actually walk a shop. Matching is keyword based and deliberately
 * forgiving — an unknown ingredient lands in "Other" rather than being hidden.
 */

export const AISLES = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Pantry",
  "Spices",
  "Frozen",
  "Drinks",
  "Other",
] as const;

export type Aisle = (typeof AISLES)[number];

const KEYWORDS: Record<Exclude<Aisle, "Other">, string[]> = {
  Produce: [
    "apple", "avocado", "banana", "basil", "bean sprout", "bell pepper", "berry",
    "blueberry", "broccoli", "cabbage", "carrot", "cauliflower", "celery",
    "chili", "chilli", "cilantro", "coriander", "corn", "cucumber", "dill",
    "eggplant", "garlic", "ginger", "grape", "green onion", "herb", "jalapeno",
    "jalapeño", "kale", "leek", "lemon", "lettuce", "lime", "mango", "mint",
    "mushroom", "onion", "orange", "parsley", "pear", "pepper flake", "potato",
    "pumpkin", "radish", "raspberry", "rosemary", "sage", "scallion", "shallot",
    "spinach", "spring onion", "squash", "strawberry", "sweet potato", "thyme",
    "tomato", "zucchini",
  ],
  "Meat & Seafood": [
    "anchovy", "bacon", "beef", "chicken", "chorizo", "clam", "cod", "crab",
    "duck", "fish", "ground beef", "ground pork", "ground turkey", "ham",
    "lamb", "lobster", "meatball", "mince", "mussel", "pancetta", "pork",
    "prawn", "prosciutto", "salami", "salmon", "sardine", "sausage", "scallop",
    "shrimp", "steak", "tilapia", "tuna", "turkey", "veal",
  ],
  "Dairy & Eggs": [
    "butter", "buttermilk", "cheddar", "cheese", "cream", "cream cheese",
    "creme fraiche", "crème fraîche", "egg", "feta", "ghee", "greek yogurt",
    "half and half", "heavy cream", "milk", "mozzarella", "parmesan",
    "ricotta", "sour cream", "yoghurt", "yogurt",
  ],
  Bakery: [
    "baguette", "bagel", "brioche", "bread", "bun", "ciabatta", "croissant",
    "pita", "sourdough", "tortilla", "naan", "roll",
  ],
  Pantry: [
    "almond", "baking powder", "baking soda", "breadcrumb", "broth", "cashew",
    "chickpea", "chocolate", "cocoa", "coconut milk", "cornstarch", "flour",
    "honey", "hot sauce", "jam", "ketchup", "lentil", "maple syrup",
    "mayonnaise", "mustard", "noodle", "nut", "oats", "oil", "olive",
    "pasta", "peanut butter", "pecan", "pine nut", "quinoa", "rice",
    "sesame", "soy sauce", "stock", "sugar", "syrup", "tahini", "tomato paste",
    "tomato sauce", "vanilla", "vinegar", "walnut", "yeast",
  ],
  Spices: [
    "allspice", "bay leaf", "black pepper", "cardamom", "cayenne", "chili powder",
    "cinnamon", "clove", "cumin", "curry powder", "garlic powder", "nutmeg",
    "onion powder", "oregano", "paprika", "peppercorn", "red pepper flake",
    "salt", "saffron", "turmeric", "spice",
  ],
  Frozen: ["frozen", "ice cream", "puff pastry", "phyllo", "filo", "peas"],
  Drinks: [
    "beer", "coffee", "cola", "juice", "soda", "sparkling water", "tea",
    "wine", "water",
  ],
};

/** Longest keywords first so "sweet potato" wins over "potato". */
const ENTRIES: [string, Aisle][] = Object.entries(KEYWORDS)
  .flatMap(([aisle, words]) => words.map((w) => [w, aisle as Aisle] as [string, Aisle]))
  .sort((a, b) => b[0].length - a[0].length);

export function aisleFor(item: string): Aisle {
  const text = item.toLowerCase();
  for (const [keyword, aisle] of ENTRIES) {
    if (text.includes(keyword)) return aisle;
  }
  return "Other";
}

/** Sort key so grocery lists always come back in walking order. */
export function aisleOrder(aisle: string): number {
  const index = (AISLES as readonly string[]).indexOf(aisle);
  return index === -1 ? AISLES.length : index;
}
