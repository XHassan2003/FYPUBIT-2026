/**
 * `dresses` covers anything worn as one piece from shoulder to hem — a shalwar
 * kameez, a kurta, a sari, a lehenga, a western dress. It exists because the
 * try-on model needs it: CatVTON fits one masked region, and that region is
 * either the upper body, the lower body, or the whole torso at once. Filing a
 * kameez under `tops` would fit the upper half and leave the wearer's own
 * trousers showing through the bottom of it.
 */
export type Category = "tops" | "bottoms" | "dresses" | "outerwear" | "shoes" | "accessories";
export type Occasion = "work" | "casual" | "date night" | "workout" | "formal";

export interface WardrobeItem {
  id: string;
  name: string;
  brand?: string;
  category: Category;
  color: string; // hex, drives the silhouette fill + swatch dot
  colorName: string;
  occasions: Occasion[];
  image?: string;
  favorite?: boolean;
}

export const CATEGORIES: Category[] = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "accessories",
];
export const OCCASIONS: Occasion[] = ["work", "casual", "date night", "workout", "formal"];

/**
 * The categories virtual try-on can actually wear.
 *
 * CatVTON is trained on VITON-HD and DressCode, which are upper body, lower
 * body and dresses. Shoes, bags and jewellery are not in its label space at
 * all — it has no notion of them, so there is no prompt or setting that would
 * make it try. `CLOTH_TYPES` in service/tryon.py is the same list on the other
 * side, and refuses anything missing from it before a generation is paid for.
 *
 * Kept here rather than only in the service so the picker never offers a piece
 * the model will refuse. A wardrobe is still a wardrobe — `CATEGORIES` is
 * unchanged, and shoes and accessories go on being stored, styled and matched
 * everywhere else in the app.
 */
export const TRY_ON_CATEGORIES: Category[] = ["tops", "bottoms", "dresses", "outerwear"];

/**
 * Whether this piece can be put on a photograph of someone.
 *
 * Two conditions, and both are the model's: it works from an image, so a
 * silhouette tells it nothing, and it only fits the categories above.
 */
export function canTryOn(item: WardrobeItem): boolean {
  return Boolean(item.image) && TRY_ON_CATEGORIES.includes(item.category);
}

// Unsplash CDN photos (Unsplash License: free for commercial use, no
// attribution required). Fictional brand names, not real-world labels — see
// README "Known gaps": these are placeholder catalog photos, not a real
// retailer feed.
function photo(id: string) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;
}

export const mockWardrobe: WardrobeItem[] = [
  { id: "top-1", name: "Oxford Shirt", brand: "Hartley Row", category: "tops", color: "#FFFFFF", colorName: "white", occasions: ["work", "formal", "casual"], image: photo("1620799139507-2a76f79a2f4d") },
  { id: "top-2", name: "Crewneck Tee", brand: "Everline", category: "tops", color: "#1C1B19", colorName: "black", occasions: ["casual", "workout"], image: photo("1581655353564-df123a1eb820") },
  { id: "top-3", name: "Knit Sweater", brand: "Aster & Oak", category: "tops", color: "#8A9A80", colorName: "sage", occasions: ["casual", "work"], image: photo("1574201635302-388dd92a4c3f") },
  { id: "top-4", name: "Silk Blouse", brand: "Maison Vale", category: "tops", color: "#F1E9DA", colorName: "cream", occasions: ["work", "date night", "formal"], image: photo("1761117228880-df2425bd70da") },
  { id: "top-5", name: "Striped Cotton Tee", brand: "Everline", category: "tops", color: "#D8D2C4", colorName: "stone", occasions: ["casual", "workout"], image: photo("1618786177957-29d9b6b26d8a") },

  { id: "bottom-1", name: "Denim Jeans", brand: "Form & Fold", category: "bottoms", color: "#3B4A6B", colorName: "indigo", occasions: ["casual"], image: photo("1570308345368-f21d4b0d81a9") },
  { id: "bottom-2", name: "Tailored Trousers", brand: "Hartley Row", category: "bottoms", color: "#3A3A3A", colorName: "charcoal", occasions: ["work", "formal"], image: photo("1624378439575-d8705ad7ae80") },
  { id: "bottom-3", name: "Cargo Pants", brand: "North & Ash", category: "bottoms", color: "#6B6E4E", colorName: "olive", occasions: ["casual", "workout"], image: photo("1594633312681-425c7b97ccd1") },
  { id: "bottom-4", name: "Pencil Skirt", brand: "Maison Vale", category: "bottoms", color: "#1C1B19", colorName: "black", occasions: ["work", "date night", "formal"], image: photo("1763444134734-166e349dcba8") },

  { id: "outer-1", name: "Wool Coat", brand: "COAST No.5", category: "outerwear", color: "#B08968", colorName: "camel", occasions: ["work", "formal", "date night"], image: photo("1611246539484-1f8e71d19ea5") },
  { id: "outer-2", name: "Denim Jacket", brand: "Form & Fold", category: "outerwear", color: "#4A5A78", colorName: "denim", occasions: ["casual"], image: photo("1611312449408-fcece27cdbb7") },
  { id: "outer-3", name: "Tailored Blazer", brand: "Hartley Row", category: "outerwear", color: "#1C1B19", colorName: "black", occasions: ["work", "formal", "date night"], image: photo("1616065297556-f05bc00c9a3e") },

  { id: "shoe-1", name: "Leather Sneakers", brand: "Birch Supply Co.", category: "shoes", color: "#FFFFFF", colorName: "white", occasions: ["casual", "workout"], image: photo("1676379827610-c380c52db0c6") },
  { id: "shoe-2", name: "Leather Loafers", brand: "Wolfe & Sons", category: "shoes", color: "#2B2420", colorName: "black", occasions: ["work", "formal", "date night"], image: photo("1616406432452-07bc5938759d") },
  { id: "shoe-3", name: "Ankle Boots", brand: "Wolfe & Sons", category: "shoes", color: "#A9784F", colorName: "tan", occasions: ["casual", "date night"], image: photo("1605733160314-4fc7dac4bb16") },
  { id: "shoe-4", name: "Running Shoes", brand: "Birch Supply Co.", category: "shoes", color: "#6E6A62", colorName: "grey", occasions: ["workout"], image: photo("1542291026-7eec264c27ff") },

  { id: "acc-1", name: "Gold Hoop Earrings", brand: "Rowan Studio", category: "accessories", color: "#B98B3E", colorName: "gold", occasions: ["date night", "formal"], image: photo("1600721391776-b5cd0e0048f9") },
  { id: "acc-2", name: "Leather Belt", brand: "Wolfe & Sons", category: "accessories", color: "#6B4A32", colorName: "brown", occasions: ["work", "casual"], image: photo("1664286074176-5206ee5dc878") },
  { id: "acc-3", name: "Silk Scarf", brand: "Maison Vale", category: "accessories", color: "#6B2545", colorName: "plum", occasions: ["work", "date night"], image: photo("1606259458027-54d2a728b6ab") },
  { id: "acc-4", name: "Canvas Tote Bag", brand: "North & Ash", category: "accessories", color: "#D8D2C4", colorName: "stone", occasions: ["casual", "work"], image: photo("1574365569389-a10d488ca3fb") },

  // South Asian formalwear, as one-piece garments so CatVTON fits the whole
  // torso at once (cloth_type `overall`) rather than half of it.
  //
  // Worth knowing before judging the results: these are **editorial photographs
  // of people wearing the garment**, not the flat product shots the rest of the
  // wardrobe uses. Unsplash has very little Pakistani or Indian clothing shot on
  // a hanger, and a model wearing a piece is a weaker reference than the piece
  // by itself — the model has to separate garment from wearer before it can
  // transfer anything. Expect these to read less crisply than the shirts below.
  // Replacing them with real product photography is the single biggest quality
  // win available here.
  { id: "dress-1", name: "Embroidered Kameez", brand: "Lahore Atelier", category: "dresses", color: "#A98BB0", colorName: "mauve", occasions: ["formal", "date night"], image: photo("1705920821957-5d1a22a1d829") },
  { id: "dress-2", name: "Kameez & Dupatta", brand: "Lahore Atelier", category: "dresses", color: "#1C1B19", colorName: "black", occasions: ["formal", "date night", "work"], image: photo("1705921266336-50fa88412176") },
  { id: "dress-3", name: "Chiffon Shalwar Kameez", brand: "Lahore Atelier", category: "dresses", color: "#A9784F", colorName: "tan", occasions: ["work", "formal"], image: photo("1705920821970-1221b67e8ced") },
  { id: "dress-4", name: "Silk Sari", brand: "Meharbani", category: "dresses", color: "#2E6B4F", colorName: "emerald", occasions: ["formal", "date night"], image: photo("1597983073512-90bd150e19f6") },
  { id: "dress-5", name: "Bridal Lehenga", brand: "Meharbani", category: "dresses", color: "#6B2545", colorName: "plum", occasions: ["formal"], image: photo("1756483488645-5973a1a92e33") },

  // Casual and relaxed-fit pieces, all shot on a hanger against a plain ground —
  // which is what CatVTON was trained on, and why these transfer better than
  // the formalwear above.
  { id: "top-6", name: "Linen Button-Down", brand: "Everline", category: "tops", color: "#3B4A6B", colorName: "indigo", occasions: ["work", "casual"], image: photo("1626497764746-6dc36546b388") },
  { id: "top-7", name: "Cotton Polo", brand: "Birch Supply Co.", category: "tops", color: "#FFFFFF", colorName: "white", occasions: ["casual", "work"], image: photo("1621773881532-fe65715b5137") },
  { id: "top-8", name: "Boxy Crew Tee", brand: "Everline", category: "tops", color: "#8A9A80", colorName: "sage", occasions: ["casual", "workout"], image: photo("1523380677598-64d85d015339") },
  { id: "top-9", name: "Striped Casual Shirt", brand: "Form & Fold", category: "tops", color: "#4A5A78", colorName: "denim", occasions: ["casual", "work"], image: photo("1613461920867-9ea115fee900") },
  { id: "top-10", name: "Relaxed Overshirt", brand: "North & Ash", category: "tops", color: "#3A3A3A", colorName: "charcoal", occasions: ["casual"], image: photo("1604898426702-4b4f1c5e973a") },

  { id: "bottom-5", name: "Baggy Jeans", brand: "Form & Fold", category: "bottoms", color: "#6E6A62", colorName: "grey", occasions: ["casual"], image: photo("1615420733239-070fc4b95914") },
  { id: "bottom-6", name: "Wide-Leg Jeans", brand: "Form & Fold", category: "bottoms", color: "#3B4A6B", colorName: "indigo", occasions: ["casual"], image: photo("1714729382642-59f19c74440e") },
];

// Placeholder colour-pairing rules, not a model. suggestOutfit() leans on this
// until the real recommender plugs in — see README "Where the real AI plugs in".
export const colorPairings: Record<string, string[]> = {
  // `mauve` and `emerald` arrived with the formalwear. A colour missing from
  // this table is not an error — the lookup falls back to an empty list and the
  // offline suggestion simply stops pairing on it — but leaving them out would
  // quietly exclude those pieces from every offline outfit.
  mauve: ["cream", "stone", "charcoal", "white", "plum"],
  emerald: ["cream", "gold", "white", "camel", "black"],

  white: ["indigo", "charcoal", "black", "camel", "tan", "olive"],
  black: ["white", "cream", "camel", "stone", "gold", "grey"],
  sage: ["cream", "stone", "black", "tan", "white"],
  cream: ["black", "camel", "plum", "indigo", "brown"],
  stone: ["black", "denim", "sage", "brown", "white"],
  indigo: ["white", "cream", "tan", "camel"],
  charcoal: ["white", "cream", "gold", "black"],
  olive: ["white", "stone", "tan", "brown"],
  camel: ["white", "black", "denim", "cream"],
  denim: ["white", "stone", "tan", "camel"],
  tan: ["indigo", "white", "olive", "denim"],
  gold: ["black", "charcoal", "plum"],
  brown: ["cream", "olive", "stone"],
  plum: ["cream", "black", "gold", "mauve"],
  grey: ["black", "white", "sage"],
};
