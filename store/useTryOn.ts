import { File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
// `expo-media-library/legacy`, not the package root, and the difference is the
// whole app.
//
// In SDK 57 the root export *is* the new API, and it binds the native module at
// class-definition time — `class Query extends ExpoMediaLibraryNext.Query`. That
// runs on import, so on a runtime without `ExpoMediaLibraryNext` it does not
// fail politely when you call it, it throws while the module is loading. Expo Go
// ships the classic `ExpoMediaLibrary` and not the Next one, so importing the
// root took down everything downstream: this store, then `try-on.tsx` and
// `(tabs)/index.tsx`, which then had no default export, and finally the tab
// layout with `Cannot read property 'ErrorBoundary' of undefined`. One bad
// import, four unrelated-looking errors.
//
// The `/legacy` subpath is the same functions against `ExpoMediaLibrary`, which
// Expo Go does have. Do not "tidy" this back to the package root without a
// development build to run it in.
import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";
import { Image as RNImage } from "react-native";
import { create } from "zustand";
import { toggleInOutfit, WardrobeItem } from "@/data/mockWardrobe";
import { useWardrobe } from "./useWardrobe";

/**
 * The try-on in progress: the photo, the piece, and the last look made.
 *
 * A store rather than screen state because two screens share it. Home shows
 * how far along you are and offers the last result back; the flow itself picks
 * up wherever Home left off. Local state would give each of them its own copy
 * and they would disagree.
 *
 * Not persisted. The generated file lives in the cache directory, so a result
 * remembered across restarts would eventually point at nothing.
 */

/**
 * A stand-in for demoing without photographing anyone. Resolved through
 * `resolveAssetSource` because the manipulator wants a URI, and a bundled
 * `require` is a module id until it is asked for one.
 *
 * Its own file rather than the `today-hero.jpg` this used to point at, and the
 * reason is the model. What it wants of the *person* photograph is **one
 * person, head to foot, front on, against a plain background, not already
 * wearing something bulky.** `today-hero.jpg` is an editorial crop — the
 * subject small in a lot of empty wall, cut off at the chest, in a heavy coat.
 * Tried against it under CatVTON, an Oxford shirt came back as a shapeless
 * drape with the hand smeared; the same shirt on this photograph came back
 * clean, in 11 seconds rather than 64.
 *
 * Those requirements survived the move to FASHN v1.6. What FASHN relaxed is the
 * *garment* side — it accepts a photograph of someone wearing the item, not
 * only a flat-lay — which is a different image and not this one.
 *
 * So: if you ever swap this image, keep those four properties. It is not a
 * question of taste, and a prettier photograph that breaks them makes the whole
 * feature look broken. (`today-hero.jpg` is still the hero on Style and the
 * card in AuthLayout — this is a second asset, not a replacement.)
 *
 * Unsplash, like the rest of assets/images/editorial and the seeded wardrobe —
 * Unsplash License, free for commercial use, no attribution required.
 * Source: unsplash.com/photos/1742320681681-1ca1e2a2583e
 */
export const TRY_ON_DEMO_PHOTO = RNImage.resolveAssetSource(
  require("@/assets/images/editorial/try-on-sample.jpg")
).uri;

/**
 * Garment images do not need to be large. The model reads them for colour, cut
 * and detail, and a full-size phone photo would make the upload slow before the
 * model had started.
 *
 * Raised from 768 with the move to FASHN v1.6, which renders at 864x1296 and is
 * specifically meant to keep garment text and print. Feeding it a reference
 * narrower than its own output would throw away the thing being paid for.
 */
const GARMENT_EDGE = 864;

/**
 * The person is the subject and gets more pixels — and under FASHN v1.6 this
 * number does more than that: **it decides the resolution of the result.**
 *
 * fal documents the model as rendering at a fixed 864x1296. Measured, it
 * matches the person image instead: a 1024-wide photograph came back
 * 1024x1280, twice. So raising this raises the output, and lowering it lowers
 * it. Left at 1024 because that is already above what fal claims and the upload
 * has to cross a phone network.
 */
const PERSON_EDGE = 1024;

const QUALITY = 0.72;

async function encode(uri: string, maxEdge: number) {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: maxEdge });

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: QUALITY,
    base64: true,
  });

  if (!saved.base64) throw new Error("Could not read that image");
  return saved.base64;
}

/**
 * File extension for what the service sent back. The try-on model returns PNG
 * where the old one returned JPEG, so this is read rather than assumed —
 * mislabelling the file is the kind of thing that only shows up in the share
 * sheet, on someone else's phone.
 */
function extensionFor(mimeType: string) {
  return mimeType === "image/png" ? "png" : "jpg";
}

/**
 * Something about the chosen photograph that will probably spoil the result.
 *
 * `headline` names what is wrong, `advice` says what would be better.
 */
export interface PhotoConcern {
  headline: string;
  advice: string;
}

/**
 * A portrait photo can be up to this wide relative to its height before it
 * stops plausibly containing a standing person head to foot.
 */
const PORTRAIT_MAX_RATIO = 0.85;

/** Below this the photo is being upscaled to reach the model's 768x1024. */
const MIN_WIDTH = 512;
const MIN_HEIGHT = 640;

/**
 * Judge the photograph on its shape alone, before a generation is paid for.
 *
 * **Be clear about how weak this is.** It reads width and height. It cannot see
 * whether there is one person or three, whether they are facing the camera,
 * how much of the frame they fill, or whether they are wearing a coat — which
 * is awkward, because those are the things that actually break a generation.
 * The photograph that produced the smeared result during development was
 * 928x1152, a perfectly reasonable portrait, and every rule below would have
 * passed it.
 *
 * So this catches one honest class of mistake — a landscape snapshot, a
 * thumbnail — and stays quiet otherwise. Silence here is silence, not a verdict
 * that the photo is good, and no copy in the UI should suggest otherwise. The
 * real guidance is the notes on step one; this is a backstop for the cases
 * where the shape alone gives the problem away.
 *
 * Exported so the rules can be read and tested in one place rather than being
 * buried in a component.
 */
export function assessPhoto(width: number, height: number): PhotoConcern | null {
  if (!width || !height) return null;

  const ratio = width / height;

  if (ratio >= 1) {
    return {
      headline: "This photo is wider than it is tall",
      advice:
        "Try-on works from a standing figure, head to feet. A landscape photo rarely has room for one, and the result is usually a smear rather than a garment.",
    };
  }

  if (ratio > PORTRAIT_MAX_RATIO) {
    return {
      headline: "This photo is nearly square",
      advice:
        "A taller crop that fits you head to feet gives the model far more to work with.",
    };
  }

  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    return {
      headline: "This photo is quite small",
      advice: `At ${width}x${height} it has to be enlarged before the model sees it, and detail that is not there cannot be invented.`,
    };
  }

  return null;
}

/** Read a photo's pixel dimensions. Resolves null rather than throwing. */
function measure(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    RNImage.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null)
    );
  });
}

export type TryOnStatus = "idle" | "generating" | "ready" | "failed";

interface TryOnState {
  photo?: string;
  /**
   * Something detectably wrong with `photo`, or undefined. Undefined also
   * covers "not measured yet" and "could not be measured", which is deliberate:
   * every one of those means the app has nothing to warn about, and inventing a
   * distinction the UI cannot act on would only complicate the render.
   */
  photoConcern?: PhotoConcern;
  /**
   * The pieces being tried on, in selection order — a single garment, or a
   * bottom and a top for a whole outfit.
   *
   * A list rather than the single `itemId` this used to hold. The rule for what
   * may be in it lives in `toggleInOutfit`, shared with the service so both
   * halves agree on what an outfit is.
   */
  itemIds: string[];
  result?: string;
  /** What `result` actually is, for naming and sharing it. */
  resultMimeType: string;
  status: TryOnStatus;
  error: string | null;

  setPhoto: (uri: string) => void;
  /**
   * Add or remove a piece, displacing whatever it conflicts with. `selected` is
   * the current selection resolved to items — see the implementation for why
   * the caller supplies it.
   */
  toggleItem: (item: WardrobeItem, selected: WardrobeItem[]) => void;
  clearItems: () => void;
  useSamplePhoto: () => void;
  pickPhoto: (source: "camera" | "library") => Promise<void>;
  /** Returns the file URI of the generated look, or null. */
  generate: (items: WardrobeItem[]) => Promise<string | null>;
  share: () => Promise<boolean>;
  /**
   * Copy the finished look into the phone's photo library. True when it
   * landed; false sets `error` with the reason.
   */
  saveToDevice: () => Promise<boolean>;
  changePhoto: () => void;
  clearError: () => void;
}

export const useTryOn = create<TryOnState>()((set, get) => {
  /**
   * Take on a new photograph: show it immediately, judge it a moment later.
   *
   * Measuring is asynchronous, and the photo must appear the instant it is
   * chosen — waiting on `getSize` before rendering would put a stall between
   * the picker closing and the image appearing, to buy a warning that is only
   * advisory.
   */
  const adopt = async (uri: string) => {
    set({ photo: uri, error: null, photoConcern: undefined });

    const size = await measure(uri);

    // The photo can change while this is in flight — a second pick, or Back.
    // Applying a stale measurement would pin one photo's warning to a different
    // photo, which is worse than showing no warning at all.
    if (get().photo !== uri) return;

    set({ photoConcern: (size && assessPhoto(size.width, size.height)) || undefined });
  };

  return {
  photo: undefined,
  photoConcern: undefined,
  itemIds: [],
  result: undefined,
  resultMimeType: "image/png",
  status: "idle",
  error: null,

  setPhoto: (uri) => {
    void adopt(uri);
  },
  /**
   * `selected` is the current selection already resolved to items, which the
   * caller has to supply.
   *
   * The store keeps ids — it is shared with Home, and an id survives the
   * wardrobe changing underneath it where a copied item would go stale. But the
   * rule in `toggleInOutfit` reads categories, and ids alone cannot be turned
   * back into items from in here without the store holding the wardrobe too.
   * Every caller already has it, so it passes what it resolved rather than this
   * store growing a dependency on `useWardrobe` to look them up again.
   */
  toggleItem: (item, selected) =>
    set({ itemIds: toggleInOutfit(selected, item).map((piece) => piece.id) }),
  clearItems: () => set({ itemIds: [] }),
  useSamplePhoto: () => {
    void adopt(TRY_ON_DEMO_PHOTO);
  },
  clearError: () => set({ error: null }),

  changePhoto: () =>
    set({
      photo: undefined,
      photoConcern: undefined,
      result: undefined,
      status: "idle",
      error: null,
    }),

  pickPhoto: async (source) => {
    set({ error: null });

    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      set({
        error:
          source === "camera"
            ? "Atelier needs camera access to take your photo."
            : "Atelier needs access to your photos.",
      });
      return;
    }

    const picked =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });

    // The picker already gives dimensions, but going through `adopt` keeps one
    // path for every photo — camera, gallery, sample — so a warning can never
    // apply to one source and quietly not the others.
    if (!picked.canceled) await adopt(picked.assets[0].uri);
  },

  generate: async (items) => {
    const { photo } = get();
    if (!photo) return null;

    if (items.length === 0) {
      set({ error: "Pick something to try on first.", status: "failed" });
      return null;
    }

    const missing = items.find((item) => !item.image);
    if (missing) {
      set({
        error: `${missing.name} has no photograph to work from.`,
        status: "failed",
      });
      return null;
    }

    set({ status: "generating", error: null, result: undefined });

    try {
      const person = await encode(photo, PERSON_EDGE);
      // A garment image can be remote (the seeded wardrobe) or a local file
      // (anything added from the phone, or imported). The manipulator reads
      // both. Encoded in parallel because a two-piece outfit would otherwise
      // pay for two resizes in series before the first request is even sent.
      const garments = await Promise.all(
        items.map(async (item) => ({
          image: await encode(item.image!, GARMENT_EDGE),
          mimeType: "image/jpeg",
          name: item.name,
          category: item.category,
        }))
      );

      const outcome = await useWardrobe
        .getState()
        .generateTryOn(person, "image/jpeg", garments);

      if (!outcome.ok) {
        set({ error: outcome.message, status: "failed" });
        return null;
      }

      // Written base64-to-disk directly rather than decoded in JS — React
      // Native's atob is not somewhere to route a megabyte of image through.
      //
      // The extension comes from what the service actually returned rather than
      // being assumed: the try-on model answers with PNG, and a PNG named .jpg
      // is a file that some share targets refuse to open.
      const file = new File(Paths.cache, `atelier-look-${Date.now()}.${extensionFor(outcome.mimeType)}`);
      file.create({ overwrite: true });
      file.write(outcome.image, { encoding: "base64" });

      set({ result: file.uri, resultMimeType: outcome.mimeType, status: "ready" });
      return file.uri;
    } catch (err) {
      // Resizing can fail on a file the picker handed us but the OS cannot
      // decode. Nothing to retry, so say so.
      console.warn("[stylist] try-on could not be prepared:", err);
      set({ error: "Something went wrong preparing your look. Try again.", status: "failed" });
      return null;
    }
  },

  share: async () => {
    const { result, resultMimeType } = get();
    if (!result) return false;

    if (!(await Sharing.isAvailableAsync())) {
      set({ error: "Sharing is not available on this device." });
      return false;
    }

    await Sharing.shareAsync(result, {
      mimeType: resultMimeType,
      dialogTitle: "Your Atelier look",
    });
    return true;
  },

  saveToDevice: async () => {
    const { result } = get();
    if (!result) return false;

    // Add-only. `writeOnly: true` asks for permission to *put* a photo in the
    // library without asking to read the library back, which is all this does
    // and all it should be trusted with. On iOS that is a visibly smaller
    // prompt, and someone who declines full access can still save.
    const permission = await MediaLibrary.requestPermissionsAsync(true);

    if (!permission.granted) {
      set({
        // `canAskAgain` false means they chose "don't allow" on a previous
        // prompt, and the OS will not show another — so the only honest advice
        // is to point at Settings rather than invite a retry that cannot work.
        error: permission.canAskAgain
          ? "Atelier needs permission to save to your photos."
          : "Photo access is off for Atelier. Turn it on in Settings to save looks.",
      });
      return false;
    }

    try {
      // The generated file lives in the cache directory, which the OS is free
      // to empty. Copying it into the photo library is what makes a look
      // outlast the app — the same reason the result is not persisted in the
      // store either.
      await MediaLibrary.saveToLibraryAsync(result);
      return true;
    } catch (err) {
      console.warn("[stylist] could not save to the photo library:", err);
      set({ error: "Could not save that to your photos. Try again." });
      return false;
    }
  },
  };
});
