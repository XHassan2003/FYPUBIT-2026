import { useSSO } from "@clerk/expo/experimental";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { authErrorMessage } from "@/constants/auth";
import { auth, fonts } from "@/constants/theme";
import { AuthSpinner } from "./AuthLayout";

/**
 * "Continue with Google", for both auth screens.
 *
 * Runs Clerk's browser-based SSO rather than the native Google SDK: the native
 * path needs a custom dev client, and this project is demoed through Expo Go.
 * `startSSOFlow` finalizes the session itself, so there is nothing to navigate
 * here — the root layout is watching `isSignedIn` and moves on its own.
 *
 * Google must be enabled as a social connection in the Clerk dashboard, and the
 * redirect URL allow-listed, before this does anything. See the README.
 */

interface GoogleButtonProps {
  /** Reported to the screen so it renders in the same slab as form errors. */
  onError: (message: string | null) => void;
  /** True while the email form is mid-request — the two cannot run at once. */
  disabled?: boolean;
}

export function GoogleButton({ onError, disabled }: GoogleButtonProps) {
  const { startSSOFlow } = useSSO();
  const [busy, setBusy] = useState(false);

  // Android opens a Custom Tab much faster from a warmed browser process; a
  // no-op elsewhere.
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const off = !!disabled || busy;

  const onPress = async () => {
    if (off) return;
    onError(null);
    setBusy(true);

    try {
      const { createdSessionId, authSessionResult, signUp } = await startSSOFlow({ strategy: "oauth_google" });

      // Backing out of the browser sheet is a decision, not a failure.
      if (authSessionResult?.type !== "success") return;
      if (createdSessionId) return;

      // Google authenticated the person, but Clerk could not turn that into a
      // session. That happens when the instance requires a field Google does
      // not return — `missingFields` names which. Logged in full because the
      // answer is a dashboard setting, not something the user can act on.
      const missingFields = signUp?.missingFields ?? [];
      console.warn(
        "[google-sso] authenticated, but no session was created:",
        JSON.stringify({
          signUpStatus: signUp?.status ?? null,
          missingFields,
          unverifiedFields: signUp?.unverifiedFields ?? [],
        })
      );

      onError(
        missingFields.length > 0
          ? `Google could not finish creating the account — Clerk still wants: ${missingFields.join(", ")}.`
          : "Google signed you in, but the account could not be completed."
      );
    } catch (error) {
      // Unlike the password methods, the SSO helper throws rather than
      // resolving with `{ error }`.
      onError(authErrorMessage(error, "We could not reach Google. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      accessibilityState={{ disabled: off, busy }}
      style={({ pressed }) => [styles.button, pressed && !off && styles.pressed, off && styles.disabled]}
    >
      {busy ? <AuthSpinner color={auth.taupe} size={16} /> : <GoogleMark />}
      <Text style={[styles.label, off && styles.labelDisabled]}>
        {busy ? "Opening Google" : "Continue with Google"}
      </Text>
    </Pressable>
  );
}

/** Google's four-colour "G", the mark their sign-in guidance requires. */
function GoogleMark() {
  return (
    <Svg width={17} height={17} viewBox="0 0 48 48">
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: auth.pill,
    borderWidth: 1,
    borderColor: auth.espressoA10,
    backgroundColor: auth.field,
  },
  pressed: { backgroundColor: auth.linen },
  disabled: { backgroundColor: "transparent", borderColor: auth.espressoA10 },
  label: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: auth.espresso,
  },
  labelDisabled: { color: auth.espressoA35 },
});
