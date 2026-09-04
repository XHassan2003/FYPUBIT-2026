// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // SDK 56 turned on the React Compiler lint rules. Two of them disagree with
    // how this app is built, in different ways and to different degrees.
    rules: {
      // Off, because it is wrong here rather than inconvenient. Reanimated's
      // shared values are mutable by design — `sharedValue.value = x` is the
      // entire API, on the UI thread, deliberately outside React's render
      // model. The rule cannot see that and flags every animation we have.
      'react-hooks/immutability': 'off',

      // Warn rather than error. The three places this fires are all "reset when
      // the input changes" — a sheet clearing its result when a different
      // garment opens, the try-on resetting its stage when generation starts.
      // React would rather these were keyed or derived, and it has a point, but
      // rewriting device-verified animation and flow code is not something to
      // do in the same change as an SDK upgrade. Left visible so it gets done.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
