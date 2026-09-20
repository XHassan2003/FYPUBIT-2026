/**
 * `migrate` — the one-time cleanup that strips the old seed wardrobe's ids
 * out of a device that persisted them before wardrobes went per-account.
 *
 * Exported precisely so this can be tested without touching AsyncStorage or
 * the network, the same reason `assessPhoto` is exported from
 * store/useTryOn.ts. What matters here is what it does and does not remove —
 * getting this wrong either leaves stock demo clothes haunting an upgraded
 * device forever, or deletes something the user actually owns.
 */

import { LEGACY_SEED_IDS, migrate } from "@/store/useWardrobe";

const PROFILE = {
  name: "Test",
  avatarColor: "#000000",
  styleTags: [],
  measurements: { height: "", chest: "", waist: "", hips: "", shoeSize: "" },
  preferences: { notifications: true, useMetric: false, includeAccessories: true },
};

function item(id: string) {
  return { id, name: id, category: "tops" as const, color: "#fff", colorName: "white", occasions: [] };
}

describe("migrate", () => {
  it("strips every legacy seed id — both the long-retired tops and the rest of the old seed array", () => {
    const persisted = {
      items: [item("top-1"), item("bottom-3"), item("dress-5"), item("shoe-2")],
      outfits: [],
      profile: PROFILE,
    };

    const result = migrate(persisted, 3);

    expect(result.items).toEqual([]);
  });

  it("leaves anything the user added untouched", () => {
    const persisted = {
      items: [item("top-1"), item(`tops-${Date.now()}`)],
      outfits: [],
      profile: PROFILE,
    };

    const result = migrate(persisted, 3);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).not.toBe("top-1");
  });

  it("passes an already-migrated (v4+) wardrobe through unchanged", () => {
    const persisted = { items: [item("top-1")], outfits: [], profile: PROFILE };

    // A real v4+ install would never have "top-1" in it — this only checks
    // that migrate does not re-run and strip it a second time, which the
    // version guard is what's actually under test here.
    const result = migrate(persisted, 4);

    expect(result.items).toEqual(persisted.items);
  });

  it("handles a version-3 install with no items at all", () => {
    const result = migrate({ items: [], outfits: [], profile: PROFILE }, 3);
    expect(result.items).toEqual([]);
  });

  it("never collides with a real user-added id — the whole point of the migration being safe", () => {
    // addItem() in useWardrobe.ts names new items `${category}-${Date.now()}`,
    // always at least ten digits. No legacy seed id should ever look like that,
    // or this migration could delete something the user actually owns.
    expect(LEGACY_SEED_IDS.some((id) => /-\d{10,}$/.test(id))).toBe(false);
  });
});
