# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

This project moved 54 → 55 → 56 → 57 in one go. Anything you remember about
SDK 54 is three releases stale, and two of those releases were breaking:

- **SDK 55** removed `newArchEnabled` and `edgeToEdgeEnabled` from app.json.
  The legacy architecture is gone and edge-to-edge is mandatory, so neither is
  a choice any more.
- **SDK 56** detached `expo-router` from react-navigation. Do not import from
  `@react-navigation/*` — those packages are uninstalled, and their types no
  longer match what expo-router passes. `app/(tabs)/_layout.tsx` reads its tab
  bar props off `Tabs` itself; copy that approach rather than reaching into
  `expo-router/build`.
- **RN 0.85** removed `StyleSheet.absoluteFillObject`. `absoluteFill` is a
  registered style, not a plain object, so it cannot be spread — write the four
  properties out.
- **SDK 56** also enabled the React Compiler lint rules. See `eslint.config.js`
  for which are off and why: `react-hooks/immutability` is wrong for Reanimated
  shared values, and `set-state-in-effect` is a warning with real work behind it.
