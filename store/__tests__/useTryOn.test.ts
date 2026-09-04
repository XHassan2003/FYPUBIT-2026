/**
 * The photo check on step three of the try-on flow.
 *
 * `assessPhoto` is the only thing standing between a user and spending a
 * generation on a photograph that cannot work, and it is pure arithmetic over
 * two numbers — which makes it both easy to test and easy to get subtly wrong.
 * A threshold nudged the wrong way does not throw: it either nags about photos
 * that were fine, or goes quiet on ones that were not, and neither shows up
 * until someone is watching a demo.
 *
 * So both sides of every boundary are pinned here. Two of the cases assert
 * *silence*, and those are the ones to leave alone: they encode real photos
 * that must never trigger a warning, including the bundled sample.
 *
 * Nothing here touches the store, the network, or a model. `assessPhoto` is
 * exported precisely so this file does not have to.
 */

import { assessPhoto } from "@/store/useTryOn";

describe("assessPhoto", () => {
  describe("photographs that must pass in silence", () => {
    // The point of the feature is that it stays out of the way. A false alarm
    // on a good photo teaches people to ignore the warning, at which point it
    // is worse than not having one.

    it("passes the bundled sample photo", () => {
      // assets/images/editorial/try-on-sample.jpg, the "Use sample" image, and
      // the one this whole feature was validated against.
      expect(assessPhoto(1024, 1280)).toBeNull();
    });

    it("passes the studio photo that produced a clean result", () => {
      expect(assessPhoto(800, 1000)).toBeNull();
    });

    it("passes an image the exact size the model itself returns", () => {
      expect(assessPhoto(768, 1024)).toBeNull();
    });
  });

  describe("the shapes it can recognise", () => {
    it("warns about a landscape photo", () => {
      // The strongest signal available: a standing figure head to foot almost
      // never fits in a frame wider than it is tall.
      expect(assessPhoto(1920, 1080)?.headline).toMatch(/wider than it is tall/i);
    });

    it("treats a perfect square as landscape rather than portrait", () => {
      // Ratio exactly 1. Worth its own case because "not portrait" and
      // "landscape" are the same branch, and an off-by-one on `>=` would let
      // every square photo through unremarked.
      expect(assessPhoto(1000, 1000)?.headline).toMatch(/wider than it is tall/i);
    });

    it("warns about a nearly square crop", () => {
      expect(assessPhoto(900, 1000)?.headline).toMatch(/nearly square/i);
    });

    it("warns about a thumbnail, and quotes its size back", () => {
      // The dimensions are in the copy because "quite small" invites the reply
      // "compared to what?".
      const concern = assessPhoto(400, 800);
      expect(concern?.headline).toMatch(/quite small/i);
      expect(concern?.advice).toContain("400x800");
    });
  });

  describe("both sides of every threshold", () => {
    // One pixel either way. These are the cases a refactor breaks silently.

    it("is silent at exactly the portrait ratio limit, and warns just past it", () => {
      expect(assessPhoto(850, 1000)).toBeNull(); // ratio 0.85 exactly
      expect(assessPhoto(851, 1000)).not.toBeNull(); // ratio 0.851
    });

    it("is silent at exactly the minimum size, and warns one pixel under", () => {
      expect(assessPhoto(512, 640)).toBeNull();
      expect(assessPhoto(511, 640)?.headline).toMatch(/quite small/i);
      expect(assessPhoto(512, 639)?.headline).toMatch(/quite small/i);
    });
  });

  describe("what it cannot see", () => {
    it("says nothing about the editorial photo that actually failed", () => {
      // Not a bug — a documented blind spot, pinned so nobody mistakes the
      // check for a judgement of the photograph.
      //
      // 928x1152 is assets/images/editorial/today-hero.jpg, which `Use sample`
      // used to point at. It is a perfectly reasonable portrait and it passes
      // every rule here, yet it produced a shapeless smear and a mangled hand,
      // because the subject is small in the frame, cropped at the chest and
      // wearing a heavy coat. None of that is visible in width and height.
      //
      // Silence from this function therefore means "nothing detectable", never
      // "this photo is good". If a future version learns to see subject size or
      // clothing, this expectation is the one that should change — deliberately.
      expect(assessPhoto(928, 1152)).toBeNull();
    });

    it("invents nothing when the photo could not be measured", () => {
      // `measure()` resolves null on failure and the store maps that to no
      // concern; zero reaches here only if that ever changes. Guarding anyway,
      // because 0/0 is NaN and every comparison against NaN is false — which
      // would fall through to "no warning" by accident rather than on purpose.
      expect(assessPhoto(0, 0)).toBeNull();
      expect(assessPhoto(0, 1000)).toBeNull();
      expect(assessPhoto(1000, 0)).toBeNull();
    });
  });
});
