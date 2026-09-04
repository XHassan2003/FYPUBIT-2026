import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ANALYSIS_TIMEOUT_MS, API_BASE_URL, API_TIMEOUT_MS, TRY_ON_TIMEOUT_MS } from "@/constants/api";
import {
  CATEGORIES,
  Category,
  OCCASIONS,
  Occasion,
  WardrobeItem,
  mockWardrobe,
  colorPairings,
} from "@/data/mockWardrobe";
import { COLOR_SEASONS, ColorSeason, SeasonId } from "@/data/colorSeasons";
import { myWardrobe } from "@/data/myWardrobe";
import { SWATCHES } from "@/data/swatches";

/**
 * What a fresh install starts with, and what `merge` reconciles a saved
 * wardrobe against on every launch.
 *
 * Two halves: the seeded demo pieces, and whatever
 * `service/tools/import_wardrobe.py` generated from your own photographs. The
 * user's own clothes come last so that if an id ever collided, theirs is the
 * one that survives the union below.
 */
const SEED_WARDROBE: WardrobeItem[] = [...mockWardrobe, ...myWardrobe];

export interface Outfit {
  id: string;
  itemIds: string[];
  occasion: Occasion;
  createdAt: number;
  /**
   * A generated try-on image, when the look was saved from that flow. Optional
   * and additive, so a wardrobe persisted before this existed rehydrates
   * unchanged — no version bump or migration needed.
   */
  previewImage?: string;
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

/**
 * What the service could read off a garment photo. Every field is optional:
 * the analyser reports only what it could actually determine, so a field it
 * was unsure of arrives absent and the form leaves it for the user. An empty
 * field costs one tap; a confidently wrong one costs trust.
 */
export interface GarmentAnalysis {
  name?: string;
  brand?: string;
  category?: Category;
  occasions: Occasion[];
  /** The app swatch the detected colour was snapped to. */
  color?: string;
  colorName?: string;
  /** What Gemini actually saw, and its distance from the chosen swatch. */
  detectedColor?: string;
  deltaE?: number;
}

/**
 * No fallback here, unlike the outfit and the match score — nothing on the
 * device can read a photograph. So the failure is reported rather than papered
 * over, and the user fills the form in by hand as they always did.
 */
export type AnalysisOutcome =
  | { ok: true; analysis: GarmentAnalysis }
  | { ok: false; message: string };

/** One reference image for the try-on: a garment, already encoded. */
export interface TryOnGarment {
  image: string;
  mimeType: string;
  name?: string;
  category?: string;
}

export type TryOnOutcome =
  | { ok: true; image: string; mimeType: string }
  | { ok: false; message: string };

export interface OutfitSuggestion {
  items: WardrobeItem[];
  /**
   * True when the recommender could not be reached and the look was assembled
   * on-device instead. The two are no longer equivalent: the service scores
   * candidate outfits on measured colour relationships, while the local rule
   * picks at random within a category. Worth saying out loud in the UI rather
   * than passing off a weaker suggestion as the real one.
   */
  styledOffline: boolean;
}

export interface MatchResult {
  isMatch: boolean;
  score: number;
  /**
   * The service's workings: the CIEDE2000 distance to the closest colour in the
   * season's palette, and which colour that was. Absent when the score came
   * from the on-device fallback, which has no distance to report.
   */
  deltaE?: number;
  nearestColor?: string;
  /**
   * True when the analyser could not be reached. The number that comes back
   * then is `pseudoScore()` — a hash of the item's id, not a measurement — so
   * this is the difference between a result and a placeholder wearing its
   * clothes. The UI has to say which one it is showing.
   */
  scoredOffline: boolean;
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
  saveOutfit: (itemIds: string[], occasion: Occasion, previewImage?: string) => void;
  removeOutfit: (id: string) => void;
  suggestOutfit: (occasion: Occasion) => Promise<OutfitSuggestion>;
  updateProfile: (patch: Partial<Profile>) => void;
  togglePreference: (key: keyof Profile["preferences"]) => void;
  setColorSeason: (season: SeasonId) => void;
  setAvatarUri: (uri: string) => void;
  matchItemToProfile: (item: WardrobeItem) => Promise<MatchResult>;
  analyseGarment: (imageBase64: string, mimeType: string) => Promise<AnalysisOutcome>;
  generateTryOn: (
    personBase64: string,
    personMimeType: string,
    garments: TryOnGarment[]
  ) => Promise<TryOnOutcome>;
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

/**
 * On-device styling: the naive colour-pairing rule the app shipped with. Kept as
 * the fallback for when the recommendation service cannot be reached, so a dead
 * laptop or a dropped network degrades the suggestion instead of breaking it.
 *
 * service/rules.py is a port of this. If you change one, change the other.
 */
function buildLocalOutfit(items: WardrobeItem[], occasion: Occasion, includeAccessories: boolean) {
  const top = pickForCategory(items, "tops", occasion);
  const bottom = pickForCategory(items, "bottoms", occasion, top?.colorName);
  const shoes = pickForCategory(items, "shoes", occasion, top?.colorName);
  const outerwear = Math.random() > 0.5 ? pickForCategory(items, "outerwear", occasion, top?.colorName) : undefined;
  const accessory = includeAccessories
    ? pickForCategory(items, "accessories", occasion, top?.colorName)
    : undefined;

  return [top, bottom, shoes, outerwear, accessory].filter((item): item is WardrobeItem => Boolean(item));
}

/**
 * The season as the service wants it. Both endpoints take the same shape, and
 * both take it in the request rather than the service holding a copy — that
 * keeps data/colorSeasons.ts the only definition of the palettes.
 */
function seasonPayload(season: ColorSeason) {
  return {
    id: season.id,
    name: season.name,
    palette: season.palette,
    compatibleColorNames: season.compatibleColorNames,
  };
}

/**
 * Ask the Python recommender for a look. Throws if it is unreachable or slow.
 *
 * `season` is sent so the recommender can prefer garments that suit the user.
 * It is undefined until they have taken the colour quiz, and today's
 * `build_outfit` ignores it either way — the wiring is in place ahead of the
 * scorer that will read it.
 */
async function fetchOutfit(
  items: WardrobeItem[],
  occasion: Occasion,
  includeAccessories: boolean,
  season: ColorSeason | undefined
) {
  // Undefined in a production build with no override, or behind a tunnel. Bail
  // before opening a socket rather than requesting "undefined/recommend".
  if (!API_BASE_URL) throw new Error("No recommender address configured");

  // fetch() has no timeout of its own — without this, an unreachable host leaves
  // the Today screen spinning until the OS gives up, which can be minutes.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        occasion,
        includeAccessories,
        season: season ? seasonPayload(season) : null,
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Recommender responded ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Recommender returned an unexpected shape");

    return data as WardrobeItem[];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Ask the service to score a garment against the user's season. Throws if it is
 * unreachable or slow, exactly like fetchOutfit — the caller falls back.
 *
 * The season travels with the request rather than living on the Python side, so
 * data/colorSeasons.ts stays the only definition of the palettes.
 */
async function fetchMatch(item: WardrobeItem, season: ColorSeason): Promise<MatchResult> {
  if (!API_BASE_URL) throw new Error("No recommender address configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item, season: seasonPayload(season) }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Matcher responded ${response.status}`);

    const data = await response.json();
    if (typeof data?.isMatch !== "boolean" || typeof data?.score !== "number") {
      throw new Error("Matcher returned an unexpected shape");
    }

    return {
      isMatch: data.isMatch,
      score: data.score,
      deltaE: typeof data.deltaE === "number" ? data.deltaE : undefined,
      nearestColor: typeof data.nearestColor === "string" ? data.nearestColor : undefined,
      scoredOffline: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Send a garment photo to the service and get back what it could read.
 *
 * The app's own vocabulary travels with the request — categories, occasions
 * and swatches — so the answer comes back in terms the form can use directly,
 * and the service holds no second copy of any of it.
 */
async function fetchAnalysis(imageBase64: string, mimeType: string): Promise<GarmentAnalysis> {
  if (!API_BASE_URL) throw new Error("No analyser address configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: imageBase64,
        mimeType,
        categories: CATEGORIES,
        occasions: OCCASIONS,
        swatches: SWATCHES,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Three failures worth telling apart, because each asks the user to do
      // something different: fix the setup, wait, or give up and type it in.
      const detail = await response.text().catch(() => "");
      throw new Error(
        response.status === 503
          ? "The analyser is not set up yet — the service needs a Gemini API key."
          : response.status === 429
            ? "The analyser is busy right now. Wait a moment and try the photo again."
            : `Analyser responded ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`
      );
    }

    const data = await response.json();
    if (typeof data !== "object" || data === null) {
      throw new Error("Analyser returned an unexpected shape");
    }

    // Everything is checked before it reaches the form. The service already
    // filters against the vocabulary it was sent, but this is the boundary
    // where a wrong value would become a wardrobe item.
    return {
      name: typeof data.name === "string" ? data.name : undefined,
      brand: typeof data.brand === "string" ? data.brand : undefined,
      category: CATEGORIES.includes(data.category) ? (data.category as Category) : undefined,
      occasions: Array.isArray(data.occasions)
        ? data.occasions.filter((occasion: unknown): occasion is Occasion =>
            OCCASIONS.includes(occasion as Occasion)
          )
        : [],
      color: typeof data.color === "string" ? data.color : undefined,
      colorName: typeof data.colorName === "string" ? data.colorName : undefined,
      detectedColor: typeof data.detectedColor === "string" ? data.detectedColor : undefined,
      deltaE: typeof data.deltaE === "number" ? data.deltaE : undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Ask the service to fit the chosen garment onto the wearer's photograph.
 *
 * The same three failures as the analyser, told apart for the same reason: fix
 * the setup, wait, or give up. This one adds a fourth — the model refusing the
 * piece, because it fits tops, bottoms and outerwear and nothing else — which
 * the service reports as a 502 whose message names the garment. That is worth
 * showing verbatim: "shoes cannot be tried on" is something the user can act
 * on, and "try-on failed" is not.
 */
async function fetchTryOn(
  personBase64: string,
  personMimeType: string,
  garments: TryOnGarment[]
): Promise<{ image: string; mimeType: string }> {
  if (!API_BASE_URL) throw new Error("No try-on address configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRY_ON_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/try-on`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ person: personBase64, personMimeType, garments }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const parsed = detail.match(/"detail"\s*:\s*"([^"]+)"/)?.[1];

      if (response.status === 429) {
        throw new Error("The studio is busy right now. Wait a moment and try again.");
      }

      // The service's own words wherever it gave any. For a refused piece it
      // names the garment; for a 503 it distinguishes a missing key from a fal
      // account with no balance left — and those need opposite fixes, so
      // flattening both to "needs an API key" would send someone re-copying a
      // key that was always fine. The generic lines below are only a fallback
      // for a response that carried no detail at all.
      if (parsed) throw new Error(parsed);

      throw new Error(
        response.status === 503
          ? "Try-on is not set up yet — the service needs a fal API key."
          : `Try-on responded ${response.status}`
      );
    }

    const data = await response.json();
    if (typeof data?.image !== "string" || !data.image) {
      throw new Error("Try-on returned no image");
    }

    return { image: data.image, mimeType: typeof data.mimeType === "string" ? data.mimeType : "image/jpeg" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The pre-service scoring, kept as the fallback. It only ever compared colour
 * names against a hardcoded list and dressed the result up with a hash of the
 * item id, so treat the number it returns as decoration — the real one comes
 * from the service.
 */
function localMatch(
  item: WardrobeItem,
  season: ColorSeason | undefined
): Omit<MatchResult, "scoredOffline"> {
  if (!season) return { isMatch: false, score: pseudoScore(item.id, 45, 65) };

  const isMatch = season.compatibleColorNames.includes(item.colorName);
  const score = isMatch
    ? pseudoScore(item.id + season.id, 84, 98)
    : pseudoScore(item.id + season.id, 38, 63);

  return { isMatch, score };
}

export const useWardrobe = create<WardrobeState>()(
  persist<WardrobeState, [], [], PersistedWardrobe>(
    (set, get) => ({
      items: SEED_WARDROBE,
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

      saveOutfit: (itemIds, occasion, previewImage) =>
        set((state) => ({
          outfits: [
            { id: `outfit-${Date.now()}`, itemIds, occasion, createdAt: Date.now(), previewImage },
            ...state.outfits,
          ],
        })),

      removeOutfit: (id) =>
        set((state) => ({
          outfits: state.outfits.filter((outfit) => outfit.id !== id),
        })),

      // Asks the Python recommender first (see service/), and falls back to the
      // on-device rule if it cannot be reached. The service is the place to put
      // the real model; this call site should not need to change again.
      suggestOutfit: async (occasion) => {
        const { items, profile } = get();
        const { includeAccessories } = profile.preferences;
        const season = profile.colorSeason ? COLOR_SEASONS[profile.colorSeason] : undefined;

        try {
          return { items: await fetchOutfit(items, occasion, includeAccessories, season), styledOffline: false };
        } catch (error) {
          console.warn("[stylist] recommender unavailable, styling on-device instead:", error);
          return { items: buildLocalOutfit(items, occasion, includeAccessories), styledOffline: true };
        }
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

      // Wired to the service, which measures the garment against the season's
      // palette in CIE Lab. The local rule is only the fallback for when it
      // cannot be reached.
      matchItemToProfile: async (item) => {
        const { profile } = get();
        const season = profile.colorSeason ? COLOR_SEASONS[profile.colorSeason] : undefined;

        // No quiz result means no palette to measure against, so there is
        // nothing for the service to do either. Not an offline result — the
        // sheet gates this behind the quiz and never asks in the first place.
        if (!season) return { ...localMatch(item, undefined), scoredOffline: false };

        try {
          return await fetchMatch(item, season);
        } catch (error) {
          console.warn("[stylist] matcher unavailable, scoring on-device instead:", error);
          return { ...localMatch(item, season), scoredOffline: true };
        }
      },

      // No fallback: reading a photograph is the one thing the device cannot
      // do for itself. A failure is reported so the form can say so and the
      // user carries on filling it in by hand.
      analyseGarment: async (imageBase64, mimeType) => {
        try {
          return { ok: true, analysis: await fetchAnalysis(imageBase64, mimeType) };
        } catch (error) {
          console.warn("[stylist] garment analysis failed:", error);
          const message =
            error instanceof Error && error.name === "AbortError"
              ? "The analyser took too long. Fill the details in below."
              : error instanceof Error
                ? error.message
                : "Could not analyse that photo.";
          return { ok: false, message };
        }
      },

      // Like the analyser, there is nothing on the device to fall back to, so
      // a failure is reported rather than papered over.
      generateTryOn: async (personBase64, personMimeType, garments) => {
        try {
          const result = await fetchTryOn(personBase64, personMimeType, garments);
          return { ok: true, ...result };
        } catch (error) {
          console.warn("[stylist] try-on failed:", error);
          const message =
            error instanceof Error && error.name === "AbortError"
              ? "The studio took too long. Try again, or pick a simpler look."
              : error instanceof Error
                ? error.message
                : "Could not create that look.";
          return { ok: false, message };
        }
      },
    }),
    {
      name: "stylist-wardrobe",
      storage: createJSONStorage(() => AsyncStorage),
      // Bump this and add a `migrate` when the persisted shape changes, so an
      // installed app doesn't rehydrate into a state its code no longer expects.
      version: 2,
      partialize: (state) => ({ items: state.items, outfits: state.outfits, profile: state.profile }),
      /**
       * Reconcile the saved wardrobe with the seed on every launch.
       *
       * `items` is persisted, so a phone that has run the app before rehydrates
       * its stored array and any newly seeded piece never appears — which on a
       * demo device looks exactly like the code not having been deployed.
       *
       * This runs in `merge` rather than `migrate` deliberately. A migration
       * fires once, on a version bump, which would mean editing this file every
       * time `myWardrobe.ts` is regenerated from a fresh batch of photographs.
       * Merging on every rehydrate means: run the importer, reload, the clothes
       * are there. It is a set construction and a filter over a few dozen items,
       * so doing it per launch costs nothing.
       *
       * Union by id — anything the user added on the device survives untouched,
       * and nothing is duplicated.
       *
       * The trade-off, stated plainly: a seed piece deliberately deleted comes
       * back on the next launch. Reappearing clothes are a smaller surprise than
       * a wardrobe that silently refuses to update, but if that ever stops being
       * true the fix is to record deletions, not to drop this merge.
       */
      merge: (persisted, current) => {
        const saved = persisted as Partial<PersistedWardrobe> | undefined;
        const items = saved?.items ?? [];
        const owned = new Set(items.map((item) => item.id));

        return {
          ...current,
          ...saved,
          items: [...items, ...SEED_WARDROBE.filter((seed) => !owned.has(seed.id))],
        };
      },
    }
  )
);

export { CATEGORIES };
export type { Category, Occasion, WardrobeItem };
