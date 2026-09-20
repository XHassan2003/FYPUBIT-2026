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

// Placeholder colour-pairing rules, not a model. suggestOutfit() leans on this
// until the real recommender plugs in — see README "Where the real AI plugs in".
export const colorPairings: Record<string, string[]> = {
  // `mauve` and `emerald` arrived with the formalwear the seed wardrobe used to
  // carry. Kept even though the seed is gone: a user's own kameez or sari is
  // exactly the kind of piece these two names cover, and a colour missing from
  // this table is not an error — the lookup falls back to an empty list and the
  // offline suggestion simply stops pairing on it.
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
