/**
 * The seed wardrobe, and the ids that were taken out of it.
 *
 * `RETIRED_SEED_IDS` drives a destructive migration: on the v2 → v3 upgrade the
 * store deletes any saved item whose id appears in that list. That is correct
 * for pieces genuinely being withdrawn, and a trap for anything else — an id
 * reused later would be silently removed from the wardrobe of every phone that
 * had not upgraded yet, once, with nothing on screen to explain it.
 *
 * So the two lists must stay disjoint, and that is what this checks.
 */

import { CATEGORIES, RETIRED_SEED_IDS, mockWardrobe } from "@/data/mockWardrobe";

describe("the seed wardrobe", () => {
  it("does not ship an id that the migration will delete", () => {
    const retired = new Set(RETIRED_SEED_IDS);
    const resurrected = mockWardrobe.filter((item) => retired.has(item.id)).map((item) => item.id);

    expect(resurrected).toEqual([]);
  });

  it("has no seeded tops, so the wearer's own shirts are the tops", () => {
    // The reason the ten were retired: ten shortlist slots per category meant
    // stock photographs crowded out the clothes the user actually owns, on
    // every single recommendation.
    expect(mockWardrobe.filter((item) => item.category === "tops")).toEqual([]);
  });

  it("still holds the pieces an outfit needs to assemble", () => {
    // `build_outfit` puts a core together from bottoms and shoes even with no
    // top available. Losing either of those would leave a fresh install unable
    // to recommend anything at all.
    for (const category of ["bottoms", "shoes"] as const) {
      expect(mockWardrobe.some((item) => item.category === category)).toBe(true);
    }
  });

  it("uses ids that cannot collide with a piece added in the app", () => {
    // The app names user pieces `${category}-${Date.now()}`. A seed id ending in
    // a long run of digits could collide, and the loser would be whichever the
    // union in SEED_WARDROBE dropped.
    const looksGenerated = mockWardrobe.filter((item) => /-\d{10,}$/.test(item.id));
    expect(looksGenerated).toEqual([]);
  });

  it("only uses categories the app knows about", () => {
    const known = new Set<string>(CATEGORIES);
    const unknown = mockWardrobe.filter((item) => !known.has(item.category));

    expect(unknown).toEqual([]);
  });
});
