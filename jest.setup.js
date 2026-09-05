/**
 * Jest setup. Stands in for the native modules that only exist on a device.
 *
 * Anything importing a store pulls in `useWardrobe`, which persists through
 * AsyncStorage — and AsyncStorage is a native module, so under Jest it resolves
 * to null and the import throws before a single test runs. The library ships an
 * in-memory mock for exactly this; it is the approach its own docs recommend.
 *
 * Kept here rather than in the one test that needed it, because every future
 * test touching a store will hit the same wall.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

/**
 * expo-media-library ships no Jest mock of its own, and importing it throws off
 * a device — it extends a native class that is not there. Anything importing
 * `store/useTryOn` then fails at *import*, which took the whole suite from 16
 * tests to 5 the moment "save to photos" was added.
 *
 * Mocked at `/legacy` because that is the path the store imports; a mock on the
 * package root would not intercept it. See the note in store/useTryOn.ts for
 * why the root is unusable in Expo Go.
 *
 * Only the two calls the store makes are stubbed. Both resolve to the happy
 * path so that a test which does not care about saving is not tripped by it;
 * a test that does care should override these itself.
 */
jest.mock("expo-media-library/legacy", () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  saveToLibraryAsync: jest.fn(async () => undefined),
}));
