import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CATEGORIES, Category, Occasion, WardrobeItem, mockWardrobe, colorPairings } from "@/data/mockWardrobe";
import { COLOR_SEASONS, SeasonId } from "@/data/colorSeasons";

export interface Outfit {
  id: string;
  itemIds: string[];
  occasion: Occasion;
  createdAt: number;
}

export interface Measurements {
  height: string;
  chest: string;
  waist: string;
  hips: string;
  shoeSize: string;
}

export interface Profile {
  name: string;
  avatarColor: string;
  avatarUri?: string;
  colorSeason?: SeasonId;
  styleTags: string[];
  measurements: Measurements;
  preferences: {
    notifications: boolean;
    useMetric: boolean;
    includeAccessories: boolean;
  };
}

export interface MatchResult {
  isMatch: boolean;
  score: number;
}

/**
 * The slice written to disk. Only data — the actions are rebuilt on every
 * launch, and persisting them would freeze today's implementations into
 * storage.
 */
type PersistedWardrobe = Pick<WardrobeState, "items" | "outfits" | "profile">;

interface WardrobeState {
  items: WardrobeItem[];
  outfits: Outfit[];
  profile: Profile;
  addItem: (item: Omit<WardrobeItem, "id">) => void;
  removeItem: (id: string) => void;
  toggleFavorite: (id: string) => void;
  saveOutfit: (itemIds: string[], occasion: Occasion) => void;
  removeOutfit: (id: string) => void;
  suggestOutfit: (occasion: Occasion) => Promise<WardrobeItem[]>;
  updateProfile: (patch: Partial<Profile>) => void;
  togglePreference: (key: keyof Profile["preferences"]) => void;
  setColorSeason: (season: SeasonId) => void;
  setAvatarUri: (uri: string) => void;
  matchItemToProfile: (item: WardrobeItem) => MatchResult;
}

// Deterministic pseudo-score so the same item always shows the same match
// percentage, without needing a real model yet.
function pseudoScore(seed: string, min: number, max: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return min + (hash % (max - min + 1));
}

function pickForCategory(items: WardrobeItem[], category: Category, occasion: Occasion, anchorColor?: string) {
  const inCategory = items.filter((item) => item.category === category && item.occasions.includes(occasion));
  const pool = inCategory.length > 0 ? inCategory : items.filter((item) => item.category === category);
  if (pool.length === 0) return undefined;

  if (anchorColor) {
    const compatible = colorPairings[anchorColor] ?? [];
    const matched = pool.filter((item) => compatible.includes(item.colorName));
    if (matched.length > 0) return matched[Math.floor(Math.random() * matched.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export const useWardrobe = create<WardrobeState>()(
  persist<WardrobeState, [], [], PersistedWardrobe>(
    (set, get) => ({
      items: mockWardrobe,
      outfits: [],
      profile: {
        name: "Hassan",
        // Ink, matching the palette. Data rather than chrome — it travels with
        // the profile, so it stays a literal here alongside the garment colours.
        avatarColor: "#15120E",
        styleTags: ["Minimal", "Tailored", "Warm neutrals"],
        measurements: { height: "5'6\"", chest: "34\"", waist: "27\"", hips: "38\"", shoeSize: "8" },
        preferences: { notifications: true, useMetric: false, includeAccessories: true },
      },

      addItem: (item) =>
        set((state) => ({
          items: [{ ...item, id: `${item.category}-${Date.now()}` }, ...state.items],
        })),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),

      toggleFavorite: (id) =>
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, favorite: !item.favorite } : item)),
        })),

      saveOutfit: (itemIds, occasion) =>
        set((state) => ({
          outfits: [{ id: `outfit-${Date.now()}`, itemIds, occasion, createdAt: Date.now() }, ...state.outfits],
        })),

      removeOutfit: (id) =>
        set((state) => ({
          outfits: state.outfits.filter((outfit) => outfit.id !== id),
        })),

      // Placeholder logic: random pick filtered by occasion and a naive colour-pairing
      // rule (data/mockWardrobe.ts#colorPairings). Replace with a fetch() to the
      // Python recommender — see README "Where the real AI plugs in".
      suggestOutfit: async (occasion) => {
        const { items, profile } = get();
        const top = pickForCategory(items, "tops", occasion);
        const bottom = pickForCategory(items, "bottoms", occasion, top?.colorName);
        const shoes = pickForCategory(items, "shoes", occasion, top?.colorName);
        const outerwear =
          Math.random() > 0.5 ? pickForCategory(items, "outerwear", occasion, top?.colorName) : undefined;
        const accessory = profile.preferences.includeAccessories
          ? pickForCategory(items, "accessories", occasion, top?.colorName)
          : undefined;

        const outfit = [top, bottom, shoes, outerwear, accessory].filter((item): item is WardrobeItem =>
          Boolean(item)
        );
        return outfit;
      },

      updateProfile: (patch) =>
        set((state) => ({
          profile: { ...state.profile, ...patch },
        })),

      togglePreference: (key) =>
        set((state) => ({
          profile: {
            ...state.profile,
            preferences: { ...state.profile.preferences, [key]: !state.profile.preferences[key] },
          },
        })),

      setColorSeason: (season) =>
        set((state) => ({
          profile: { ...state.profile, colorSeason: season },
        })),

      setAvatarUri: (uri) =>
        set((state) => ({
          profile: { ...state.profile, avatarUri: uri },
        })),

      // Placeholder logic: checks the item's colour against the quiz-derived
      // season's palette (data/colorSeasons.ts). Replace with a fetch() to the
      // Python recommender — see README "Where the real AI plugs in".
      matchItemToProfile: (item) => {
        const { profile } = get();
        if (!profile.colorSeason) return { isMatch: false, score: pseudoScore(item.id, 45, 65) };
        const season = COLOR_SEASONS[profile.colorSeason];
        const isMatch = season.compatibleColorNames.includes(item.colorName);
        const score = isMatch ? pseudoScore(item.id + season.id, 84, 98) : pseudoScore(item.id + season.id, 38, 63);
        return { isMatch, score };
      },
    }),
    {
      name: "stylist-wardrobe",
      storage: createJSONStorage(() => AsyncStorage),
      // Bump this and add a `migrate` when the persisted shape changes, so an
      // installed app doesn't rehydrate into a state its code no longer expects.
      version: 1,
      partialize: (state) => ({ items: state.items, outfits: state.outfits, profile: state.profile }),
    }
  )
);

export { CATEGORIES };
export type { Category, Occasion, WardrobeItem };
