/**
 * The offline-first sync layer's network-facing pieces.
 *
 * `constants/api` is mocked to force a fake service address — under Jest
 * there is no Metro `hostUri` to derive one from, so API_BASE_URL is
 * undefined by default and every call below would short-circuit before ever
 * touching the network. `globalThis.fetch` is mocked per test for the JSON
 * calls (GET/PUT /wardrobe); `expo-file-system`'s `File.upload()` is mocked
 * for the photo upload, since that is what it actually goes through — see
 * the comment on `uploadImage` in wardrobeSync.ts for why it is not `fetch`.
 * Neither hits a real network, the same reason none of this project's other
 * tests call a real model.
 *
 * What matters most here is what every one of these functions do on
 * *failure*: they must resolve to a fallback value rather than throw, the
 * same contract fetchOutfit/fetchMatch already keep in useWardrobe.ts — a
 * thrown rejection from here would turn a sleeping laptop into a crashed
 * screen instead of a quiet stay-on-local-storage.
 */

jest.mock("@/constants/api", () => ({
  API_BASE_URL: "http://example.invalid:8000",
  WARDROBE_SYNC_TIMEOUT_MS: 1000,
  IMAGE_UPLOAD_TIMEOUT_MS: 1000,
}));

const mockUpload = jest.fn();

jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    name: uri.split("/").pop() ?? "photo.jpg",
    upload: mockUpload,
  })),
  UploadType: { BINARY_CONTENT: 0, MULTIPART: 1 },
}));

import type { WardrobeItem } from "@/store/useWardrobe";
import { backfillImages, pullWardrobe, pushWardrobe } from "@/store/wardrobeSync";

const BLOB = {
  items: [] as WardrobeItem[],
  outfits: [],
  profile: {
    name: "Test",
    avatarColor: "#000000",
    styleTags: [],
    measurements: { height: "", chest: "", waist: "", hips: "", shoeSize: "" },
    preferences: { notifications: true, useMetric: false, includeAccessories: true },
  },
};

function mockFetchOnce(impl: () => Promise<Partial<Response>>) {
  globalThis.fetch = jest.fn(impl) as unknown as typeof fetch;
}

afterEach(() => {
  jest.restoreAllMocks();
  mockUpload.mockReset();
});

describe("pullWardrobe", () => {
  it("tells a genuine 404 apart from a network failure", async () => {
    mockFetchOnce(async () => ({ ok: false, status: 404 }));
    await expect(pullWardrobe("token")).resolves.toEqual({ status: "not-found" });
  });

  it("returns the parsed wardrobe on success", async () => {
    mockFetchOnce(async () => ({ ok: true, status: 200, json: async () => BLOB }) as Response);
    await expect(pullWardrobe("token")).resolves.toEqual({ status: "found", blob: BLOB });
  });

  it("degrades to unreachable rather than throwing, on a network error", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    await expect(pullWardrobe("token")).resolves.toEqual({ status: "unreachable" });
  });

  it("degrades to unreachable on a response that isn't a wardrobe", async () => {
    mockFetchOnce(async () => ({ ok: true, status: 200, json: async () => ({ nonsense: true }) }) as Response);
    await expect(pullWardrobe("token")).resolves.toEqual({ status: "unreachable" });
  });
});

describe("pushWardrobe", () => {
  it("resolves true on a successful push", async () => {
    mockFetchOnce(async () => ({ ok: true, status: 204 }));
    await expect(pushWardrobe("token", BLOB)).resolves.toBe(true);
  });

  it("resolves false rather than throwing, on failure", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    await expect(pushWardrobe("token", BLOB)).resolves.toBe(false);
  });
});

describe("backfillImages", () => {
  const ITEMS: WardrobeItem[] = [
    {
      id: "top-1",
      name: "Oxford Shirt",
      category: "tops",
      color: "#FFFFFF",
      colorName: "white",
      occasions: ["work"],
      image: "file:///data/user/0/app/cache/shirt.jpg",
    },
    {
      id: "top-2",
      name: "Seed Tee",
      category: "tops",
      color: "#1C1B19",
      colorName: "black",
      occasions: ["casual"],
      image: "https://images.unsplash.com/tee.jpg",
    },
  ];

  it("uploads only the photo that has never left the device", async () => {
    mockUpload.mockResolvedValueOnce({
      status: 200,
      body: JSON.stringify({ url: "https://cdn.example.invalid/shirt.jpg" }),
      headers: {},
    });

    const result = await backfillImages("token", ITEMS);

    expect(result.changed).toBe(true);
    expect(result.items[0].image).toBe("https://cdn.example.invalid/shirt.jpg");
    expect(result.items[1].image).toBe("https://images.unsplash.com/tee.jpg");
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it("reports nothing changed, and uploads nothing, when every image is already remote", async () => {
    const result = await backfillImages("token", [ITEMS[1]]);

    expect(result.changed).toBe(false);
    expect(result.items).toEqual([ITEMS[1]]);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("leaves a local photo as-is, rather than dropping it, when the upload fails", async () => {
    mockUpload.mockRejectedValueOnce(new Error("network down"));

    const result = await backfillImages("token", [ITEMS[0]]);

    expect(result.changed).toBe(false);
    expect(result.items[0].image).toBe(ITEMS[0].image);
  });

  it("leaves a local photo as-is when the server rejects the upload", async () => {
    mockUpload.mockResolvedValueOnce({ status: 500, body: "internal error", headers: {} });

    const result = await backfillImages("token", [ITEMS[0]]);

    expect(result.changed).toBe(false);
    expect(result.items[0].image).toBe(ITEMS[0].image);
  });
});
