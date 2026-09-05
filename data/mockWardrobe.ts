/**
 * `dresses` covers anything worn as one piece from shoulder to hem — a shalwar
 * kameez, a kurta, a sari, a lehenga, a western dress. It exists because the
 * try-on model needs it: it fits one region per pass, and that region is
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
 * The try-on model knows three: tops, bottoms and one-pieces. Shoes, bags and
 * jewellery are not categories it has, so there is no prompt or setting that
 * would make it try. `FASHN_CATEGORIES` in service/tryon.py is the same list on
 * the other side, and refuses anything missing from it before a generation is
 * paid for.
 *
 * Kept here rather than only in the service so the picker never offers a piece
 * the model will refuse. A wardrobe is still a wardrobe — `CATEGORIES` is
 * unchanged, and shoes and accessories go on being stored, styled and matched
 * everywhere else in the app.
 */
/** The subset of `Category` that try-on can wear. */
export type TryOnCategory = "tops" | "bottoms" | "dresses" | "outerwear";

export const TRY_ON_CATEGORIES: TryOnCategory[] = ["tops", "bottoms", "dresses", "outerwear"];

/**
 * Whether this piece can be put on a photograph of someone.
 *
 * Two conditions, and both are the model's: it works from an image, so a
 * silhouette tells it nothing, and it only fits the categories above.
 */
export function canTryOn(item: WardrobeItem): boolean {
  // The cast is the narrowing this function performs: `includes` on a
  // TryOnCategory[] will not accept a plain Category, and the answer is the
  // whole point of asking.
  return Boolean(item.image) && TRY_ON_CATEGORIES.includes(item.category as TryOnCategory);
}

/** Which part of the body a garment occupies. */
export type BodySlot = "upper" | "lower" | "whole";

/**
 * The rule for what can be worn together, mirroring `BODY_SLOTS` in
 * service/tryon.py.
 *
 * `tops` and `outerwear` share a slot on purpose. The try-on model has one
 * upper-body category, so a shirt and a coat are not two layers to it — the
 * second pass would simply paint over the first, and the generation spent on
 * the shirt would vanish.
 */
export const BODY_SLOTS: Record<TryOnCategory, BodySlot> = {
  tops: "upper",
  outerwear: "upper",
  bottoms: "lower",
  dresses: "whole",
};

/** Undefined for a piece try-on cannot wear at all — shoes, accessories. */
export function bodySlot(item: WardrobeItem): BodySlot | undefined {
  return BODY_SLOTS[item.category as TryOnCategory];
}

/**
 * Add a piece to a selection, and take out whatever it displaces.
 *
 * The whole outfit rule in one place, because the flow and the store both need
 * it and two copies would drift:
 *
 * - tapping a selected piece removes it
 * - a piece replaces anything already filling its part of the body
 * - a one-piece is worn alone, so it clears everything and everything clears it
 *
 * Returns a new array; never mutates.
 */
export function toggleInOutfit(selected: WardrobeItem[], item: WardrobeItem): WardrobeItem[] {
  if (selected.some((piece) => piece.id === item.id)) {
    return selected.filter((piece) => piece.id !== item.id);
  }

  const slot = bodySlot(item);
  if (slot === undefined) return selected;
  if (slot === "whole") return [item];

  return [
    ...selected.filter((piece) => bodySlot(piece) !== slot && bodySlot(piece) !== "whole"),
    item,
  ];
}

// Unsplash CDN photos (Unsplash License: free for commercial use, no
// attribution required). Fictional brand names, not real-world labels — see
// README "Known gaps": these are placeholder catalog photos, not a real
// retailer feed.
function photo(id: string) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;
}

/**
 * Seeded ids that used to exist and have been deliberately retired.
 *
 * Removing a piece from `mockWardrobe` is not enough on its own: `items` is
 * persisted, so a phone that already ran the app keeps its saved copy forever.
 * The migration in store/useWardrobe.ts strips these once, on the version bump
 * that retired them.
 *
 * These are the ten seeded tops. They were stock photographs of clothes nobody
 * involved owns, and with only ten shortlist slots per category they crowded
 * out the wearer's own shirts on every recommendation — the whole reason the
 * feature looked broken. Everything else in the seed stays: an outfit still
 * needs bottoms and shoes to assemble, and the cultural pieces are what the
 * try-on demo is built around.
 */
export const RETIRED_SEED_IDS = [
  "top-1",
  "top-2",
  "top-3",
  "top-4",
  "top-5",
  "top-6",
  "top-7",
  "top-8",
  "top-9",
  "top-10",
];

export const mockWardrobe: WardrobeItem[] = [
  // No seeded `tops`. See RETIRED_SEED_IDS above — the wearer's own shirts are
  // the tops now, which is the point of the app.

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

  // South Asian formalwear, as one-piece garments so try-on dresses the whole
  // body in a single pass (FASHN `one-pieces`) rather than half of it.
  //
  // These are **editorial photographs of people wearing the garment**, not the
  // flat product shots the rest of the wardrobe uses — Unsplash has very little
  // Pakistani or Indian clothing shot on a hanger. That used to be a real
  // problem: CatVTON had to separate garment from wearer first and returned a
  // smeared drape. FASHN v1.6 takes on-model references as a supported input,
  // and the same lilac kameez now comes back with its embroidery legible. They
  // are no longer the weak items in the wardrobe.
  { id: "dress-1", name: "Embroidered Kameez", brand: "Lahore Atelier", category: "dresses", color: "#A98BB0", colorName: "mauve", occasions: ["formal", "date night"], image: photo("1705920821957-5d1a22a1d829") },
  { id: "dress-2", name: "Kameez & Dupatta", brand: "Lahore Atelier", category: "dresses", color: "#1C1B19", colorName: "black", occasions: ["formal", "date night", "work"], image: photo("1705921266336-50fa88412176") },
  { id: "dress-3", name: "Chiffon Shalwar Kameez", brand: "Lahore Atelier", category: "dresses", color: "#A9784F", colorName: "tan", occasions: ["work", "formal"], image: photo("1705920821970-1221b67e8ced") },
  { id: "dress-4", name: "Silk Sari", brand: "Meharbani", category: "dresses", color: "#2E6B4F", colorName: "emerald", occasions: ["formal", "date night"], image: photo("1597983073512-90bd150e19f6") },
  { id: "dress-5", name: "Bridal Lehenga", brand: "Meharbani", category: "dresses", color: "#6B2545", colorName: "plum", occasions: ["formal"], image: photo("1756483488645-5973a1a92e33") },

  // The relaxed-fit tops that used to sit here are retired too — same reason,
  // and their ids are in RETIRED_SEED_IDS.

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
