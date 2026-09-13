import { useAuth } from "@clerk/expo";
import { File, UploadType } from "expo-file-system";
import { useEffect, useRef } from "react";
import { API_BASE_URL, IMAGE_UPLOAD_TIMEOUT_MS, WARDROBE_SYNC_TIMEOUT_MS } from "@/constants/api";
import { Outfit, Profile, useWardrobe, WardrobeItem } from "./useWardrobe";

/**
 * The account's whole wardrobe, in one piece — exactly what zustand's
 * `persist` already treats as one unit (see PersistedWardrobe in
 * useWardrobe.ts). GET and PUT /wardrobe both speak this shape.
 */
interface WardrobeBlob {
  items: WardrobeItem[];
  outfits: Outfit[];
  profile: Profile;
}

/**
 * How long a run of store mutations (adding a few items, toggling several
 * favourites) is allowed to settle before it becomes one PUT rather than
 * one per change.
 */
const SYNC_DEBOUNCE_MS = 2500;

type PullOutcome =
  | { status: "found"; blob: WardrobeBlob }
  | { status: "not-found" }
  | { status: "unreachable" };

/**
 * Ask the service for this account's synced wardrobe.
 *
 * "not-found" and "unreachable" are kept apart on purpose: only a genuine
 * 404 means "this account has never synced, so local storage is the seed of
 * its server record." A network failure must not be read the same way — the
 * caller stays on local storage and tries again on the next launch or
 * mutation instead of risking a push built on a request that never actually
 * reached the server.
 */
export async function pullWardrobe(token: string): Promise<PullOutcome> {
  if (!API_BASE_URL) return { status: "unreachable" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WARDROBE_SYNC_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/wardrobe`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    if (response.status === 404) return { status: "not-found" };
    if (!response.ok) throw new Error(`Wardrobe pull responded ${response.status}`);

    const data = await response.json();
    if (!data || !Array.isArray(data.items) || !Array.isArray(data.outfits) || !data.profile) {
      throw new Error("Wardrobe pull returned an unexpected shape");
    }

    return { status: "found", blob: data as WardrobeBlob };
  } catch (error) {
    console.warn("[stylist] wardrobe pull failed, staying on local storage:", error);
    return { status: "unreachable" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Replace the account's wardrobe with this device's, in full.
 *
 * Whole-blob, last-write-wins — there is no merge on either side. A failure
 * here is not surfaced to the UI: the next mutation schedules another push,
 * so a sleeping laptop costs a stale server copy, not a broken screen.
 */
export async function pushWardrobe(token: string, blob: WardrobeBlob): Promise<boolean> {
  if (!API_BASE_URL) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WARDROBE_SYNC_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/wardrobe`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(blob),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Wardrobe push responded ${response.status}`);
    return true;
  } catch (error) {
    console.warn("[stylist] wardrobe push failed, will retry on the next change:", error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Upload one photo and return where it now lives, or null if that failed.
 *
 * Goes through expo-file-system's `File.upload()` rather than a hand-built
 * `fetch` + `FormData` request. The obvious approach —
 * `form.append("file", { uri, name, type })`, the classic RN file-descriptor
 * shape — throws "Unsupported FormDataPart implementation" on this RN
 * version's networking stack; `File.upload()` is Expo's own, version-safe
 * replacement for exactly this, and does not touch FormData at all.
 */
async function uploadImage(token: string, localUri: string): Promise<string | null> {
  if (!API_BASE_URL) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_UPLOAD_TIMEOUT_MS);

  try {
    const file = new File(localUri);
    const mimeType = file.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

    const result = await file.upload(`${API_BASE_URL}/wardrobe/images`, {
      httpMethod: "POST",
      uploadType: UploadType.MULTIPART,
      fieldName: "file",
      mimeType,
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Image upload responded ${result.status}`);
    }

    const data = JSON.parse(result.body);
    return typeof data?.url === "string" ? data.url : null;
  } catch (error) {
    console.warn("[stylist] photo upload failed, will retry on the next sync:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Upload any garment photo that has never left the device, and rewrite the
 * item to point at the result.
 *
 * Only `file://` values are touched — the seed wardrobe's `https://` photos
 * and whatever the bulk import tool wrote are left exactly as they are. This
 * runs before every push, so it carries up both a photo added moments ago
 * and one that was already sitting in AsyncStorage from before this feature
 * existed.
 */
export async function backfillImages(
  token: string,
  items: WardrobeItem[]
): Promise<{ items: WardrobeItem[]; changed: boolean }> {
  let changed = false;
  const next: WardrobeItem[] = [];

  // One at a time, deliberately. Unlike the JSON sync, an upload leaves the
  // LAN and competes for the device's real internet uplink — firing several
  // at once (this ran against 6 photos in testing) can starve every one of
  // them past its own timeout instead of a few succeeding cleanly. This is a
  // background backfill, not something blocking a screen, so trading
  // wall-clock time for reliability is the right side of that trade.
  for (const item of items) {
    if (!item.image?.startsWith("file://")) {
      next.push(item);
      continue;
    }

    const url = await uploadImage(token, item.image);
    if (!url) {
      next.push(item);
      continue;
    }

    changed = true;
    next.push({ ...item, image: url });
  }

  return { items: next, changed };
}

/**
 * Backfill whatever photos are still local-only, then push the wardrobe.
 * Shared by the initial reconcile's "not-found" branch and every later
 * mutation, so there is exactly one place that decides what a push contains.
 */
async function backfillAndPush(token: string): Promise<void> {
  const { items, outfits, profile } = useWardrobe.getState();
  const backfilled = await backfillImages(token, items);

  // Persisted through the store's own AsyncStorage `persist`, not a second
  // write path — this is the only place a remote image URL is saved back.
  if (backfilled.changed) useWardrobe.setState({ items: backfilled.items });

  await pushWardrobe(token, { items: backfilled.items, outfits, profile });
}

/**
 * Wires the local wardrobe to the signed-in account. Call once, near the
 * root of the app — see app/_layout.tsx.
 *
 * Offline-first throughout: AsyncStorage (already wired in useWardrobe.ts)
 * stays the source of truth for a device with no reachable service, exactly
 * as it is today. This hook only adds a layer on top — pull once per
 * sign-in, push after every change — and every network call in it degrades
 * to "do nothing, try again later" rather than breaking a screen.
 */
export function useWardrobeSync(): void {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();

  // Which account has already run the initial pull-or-push reconcile this
  // app session. Mutations are not pushed until their own account has been
  // reconciled — otherwise the reconcile's own `setState` calls (adopting
  // the server's wardrobe, or rewriting a backfilled image) would trigger a
  // premature push of a wardrobe that has not been decided yet.
  const reconciledFor = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushInFlight = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    if (reconciledFor.current === userId) return;

    let cancelled = false;

    (async () => {
      if (!useWardrobe.persist.hasHydrated()) {
        await new Promise<void>((resolve) => {
          const unsubscribe = useWardrobe.persist.onFinishHydration(() => {
            unsubscribe();
            resolve();
          });
        });
      }
      if (cancelled) return;

      const token = await getToken();
      if (!token || cancelled) return;

      const outcome = await pullWardrobe(token);
      if (cancelled) return;

      if (outcome.status === "found") {
        // The server wins outright once a record exists — see
        // wardrobeSync's own reasoning in the project plan: it is, by
        // definition, the union of everything ever pushed for this
        // account, so preferring it needs no field-by-field merge.
        useWardrobe.setState({
          items: outcome.blob.items,
          outfits: outcome.blob.outfits,
          profile: outcome.blob.profile,
        });
      } else if (outcome.status === "not-found") {
        // Nothing to adopt — this device's local wardrobe becomes the seed
        // of the account's server record instead of being overwritten by
        // an empty one.
        await backfillAndPush(token);
      }
      // "unreachable": stay on local storage, exactly as before this hook
      // existed. The next launch or mutation tries again.

      if (!cancelled) reconciledFor.current = userId;
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, getToken]);

  useEffect(() => {
    if (!isSignedIn || !userId) return;

    const runSync = () => {
      if (pushInFlight.current) return;
      pushInFlight.current = true;

      (async () => {
        try {
          const token = await getToken();
          if (token) await backfillAndPush(token);
        } finally {
          pushInFlight.current = false;
        }
      })();
    };

    const scheduleSync = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(runSync, SYNC_DEBOUNCE_MS);
    };

    const unsubscribe = useWardrobe.subscribe(() => {
      if (reconciledFor.current !== userId) return;
      scheduleSync();
    });

    return () => {
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isSignedIn, userId, getToken]);
}
