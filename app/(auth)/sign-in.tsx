import { useSignIn } from "@clerk/expo";
import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthField } from "@/components/AuthField";
import { Button } from "@/components/Button";
import { authErrorMessage } from "@/constants/auth";
import { colors, gutter, spacing, type } from "@/constants/theme";

export default function SignInScreen() {
  const { signIn, fetchStatus } = useSignIn();

  // Clerk accepts either identifier on this instance, so the field takes both
  // rather than making people remember which one they signed up with.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const busy = fetchStatus === "fetching";
  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setFormError(null);

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
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[type.eyebrow, styles.ash]}>Atelier</Text>
          <Text style={[type.hero, styles.title]}>Welcome</Text>
          <Text style={[type.heroItalic, styles.titleItalic]}>back.</Text>
          <Text style={[type.body, styles.lede]}>
            Sign in to reach your wardrobe and the looks you have saved.
          </Text>

          <View style={styles.fields}>
            <AuthField
              label="Email or username"
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
            />
            <View style={styles.fieldGap}>
              <AuthField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                autoCapitalize="none"
                autoComplete="current-password"
                secureTextEntry
                textContentType="password"
                onSubmitEditing={submit}
                returnKeyType="go"
              />
            </View>
          </View>

          {formError ? <Text style={[type.small, styles.error]}>{formError}</Text> : null}

          <View style={styles.submit}>
            <Button label={busy ? "Signing in…" : "Sign in"} onPress={submit} disabled={!canSubmit} />
          </View>

          <View style={styles.switch}>
            <Text style={type.small}>New here?</Text>
            <Link href="/(auth)/sign-up" style={styles.link}>
              <Text style={[type.caps, styles.linkLabel]}>Create an account</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingTop: spacing.xxxl, paddingBottom: spacing.xxxl },
  ash: { color: colors.ash },
  title: { marginTop: spacing.xl },
  titleItalic: {},
  lede: { marginTop: spacing.lg, maxWidth: 300 },
  fields: { marginTop: spacing.xxxl },
  fieldGap: { marginTop: spacing.xl + spacing.xs },
  error: { marginTop: spacing.xl, color: colors.ember },
  submit: { marginTop: spacing.xxxl },
  switch: { marginTop: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.md },
  link: { paddingVertical: spacing.xs },
  linkLabel: { color: colors.ink },
});
