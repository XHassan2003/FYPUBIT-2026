import { File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { Image as RNImage } from "react-native";
import { create } from "zustand";
import { WardrobeItem } from "@/data/mockWardrobe";
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
 */
export const TRY_ON_DEMO_PHOTO = RNImage.resolveAssetSource(
  require("@/assets/images/editorial/today-hero.jpg")
).uri;

/**
 * Reference images do not need to be large. The generator reads them for
 * colour, cut and detail, all of which survive 768px, and full-size photos
 * would make the request slow before the model had started.
 */
const GARMENT_EDGE = 768;

/** The person is the subject, so they get more pixels than the garment. */
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

export type TryOnStatus = "idle" | "generating" | "ready" | "failed";

interface TryOnState {
  photo?: string;
  itemId?: string;
  result?: string;
  status: TryOnStatus;
  error: string | null;

  setPhoto: (uri: string) => void;
  setItemId: (id: string) => void;
  useSamplePhoto: () => void;
  pickPhoto: (source: "camera" | "library") => Promise<void>;
  /** Returns the file URI of the generated look, or null. */
  generate: (item: WardrobeItem) => Promise<string | null>;
  share: () => Promise<boolean>;
  changePhoto: () => void;
  clearError: () => void;
}

export const useTryOn = create<TryOnState>()((set, get) => ({
  photo: undefined,
  itemId: undefined,
  result: undefined,
  status: "idle",
  error: null,

  setPhoto: (uri) => set({ photo: uri, error: null }),
  setItemId: (id) => set({ itemId: id }),
  useSamplePhoto: () => set({ photo: TRY_ON_DEMO_PHOTO, error: null }),
  clearError: () => set({ error: null }),

  changePhoto: () => set({ photo: undefined, result: undefined, status: "idle", error: null }),

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

    if (!picked.canceled) set({ photo: picked.assets[0].uri, error: null });
  },

  generate: async (item) => {
    const { photo } = get();
    if (!photo) return null;

    if (!item.image) {
      set({ error: "That piece has no photograph to work from.", status: "failed" });
      return null;
    }

    set({ status: "generating", error: null, result: undefined });

    try {
      const person = await encode(photo, PERSON_EDGE);
      // A garment image can be remote (the seeded wardrobe) or a local file
      // (anything added from the phone). The manipulator reads both.
      const garment = await encode(item.image, GARMENT_EDGE);

      const outcome = await useWardrobe.getState().generateTryOn(person, "image/jpeg", [
        { image: garment, mimeType: "image/jpeg", name: item.name, category: item.category },
      ]);

      if (!outcome.ok) {
        set({ error: outcome.message, status: "failed" });
        return null;
      }

      // Written base64-to-disk directly rather than decoded in JS — React
      // Native's atob is not somewhere to route a megabyte of image through.
      const file = new File(Paths.cache, `atelier-look-${Date.now()}.jpg`);
      file.create({ overwrite: true });
      file.write(outcome.image, { encoding: "base64" });

      set({ result: file.uri, status: "ready" });
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
    const { result } = get();
    if (!result) return false;

    if (!(await Sharing.isAvailableAsync())) {
      set({ error: "Sharing is not available on this device." });
      return false;
    }

    await Sharing.shareAsync(result, { mimeType: "image/jpeg", dialogTitle: "Your Atelier look" });
    return true;
  },
}));
