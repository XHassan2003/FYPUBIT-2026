import { useSignIn } from "@clerk/expo";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AuthDivider, AuthInput, AuthLayout, AuthNotice, AuthSubmit } from "@/components/AuthLayout";
import { GoogleButton } from "@/components/GoogleButton";
import { authErrorMessage } from "@/constants/auth";
import { auth, fonts, spacing } from "@/constants/theme";

export default function SignInScreen() {
  const { signIn, fetchStatus } = useSignIn();

  // Clerk accepts either identifier on this instance, so the field takes both
  // rather than making people remember which one they signed up with.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  // Presentation only — the recovery flow is not built yet.
  const [notice, setNotice] = useState<string | null>(null);

  const busy = fetchStatus === "fetching";
  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setFormError(null);
    setNotice(null);

    const { error } = await signIn.password({ identifier: identifier.trim(), password });
    if (error) {
      setFormError(authErrorMessage(error, "We could not sign you in. Check your details and try again."));
      return;
    }

    if (signIn.status === "complete") {
      // Promotes the sign-in to the active session. The root layout is watching
      // that, so navigation happens on its own — no router call here.
      const { error: finalizeError } = await signIn.finalize();
      if (finalizeError) setFormError(authErrorMessage(finalizeError));
      return;
    }

    // Multi-factor and device-trust flows land here. Not enabled for this
    // project, so say so plainly rather than failing silently.
    setFormError("This account needs a verification step the app does not support yet.");
  };

  return (
    <AuthLayout
      label="Sign in"
      title={"Welcome back to your\nstyling studio."}
      subtitle="Sign in to reach your wardrobe, saved looks and personal colour palette."
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerLabel}>New to Atelier? </Text>
          <Link href="/(auth)/sign-up">
            <Text style={styles.footerLink}>Create an account</Text>
          </Link>
        </View>
      }
    >
      <View style={styles.fields}>
        <AuthInput
          label="Email or username"
          value={identifier}
          onChangeText={(v) => {
            setIdentifier(v);
            setFormError(null);
          }}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          keyboardType="email-address"
        />
        <AuthInput
          label="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setFormError(null);
          }}
          placeholder="Your password"
          autoCapitalize="none"
          autoComplete="current-password"
          secureTextEntry
          textContentType="password"
          onSubmitEditing={submit}
          returnKeyType="go"
        />
      </View>

      <View style={styles.forgotRow}>
        <Pressable
          onPress={() => setNotice("Password recovery is not part of this prototype yet.")}
          accessibilityRole="button"
          hitSlop={8}
        >
          {({ pressed }) => (
            <Text style={[styles.forgot, pressed && styles.forgotPressed]}>Forgot password?</Text>
          )}
        </Pressable>
      </View>

      {formError ? <AuthNotice message={formError} tone="error" /> : notice ? <AuthNotice message={notice} /> : null}

      <View style={styles.submit}>
        <AuthSubmit label="Sign in" busyLabel="Signing in" onPress={submit} busy={busy} disabled={!canSubmit} />
      </View>

      <View style={styles.divider}>
        <AuthDivider />
      </View>

      <GoogleButton
        onError={(message) => {
          setFormError(message);
          setNotice(null);
        }}
        disabled={busy}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 20 },
  forgotRow: { marginTop: spacing.lg, alignItems: "flex-end" },
  forgot: { fontFamily: fonts.light, fontSize: 12, lineHeight: 16, color: auth.taupe },
  forgotPressed: { color: auth.espresso },
  submit: { marginTop: 28 },
  divider: { marginVertical: spacing.xl },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: auth.espressoA10,
    paddingTop: spacing.xl,
  },
  footerLabel: { fontFamily: fonts.light, fontSize: 13, lineHeight: 20, color: auth.taupe },
  footerLink: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: auth.espresso,
    textDecorationLine: "underline",
  },
});
