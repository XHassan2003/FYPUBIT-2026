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
