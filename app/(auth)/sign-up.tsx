import { useSignUp } from "@clerk/expo";
import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthField } from "@/components/AuthField";
import { Button } from "@/components/Button";
import { authErrorMessage } from "@/constants/auth";
import { colors, gutter, spacing, type } from "@/constants/theme";

export default function SignUpScreen() {
  const { signUp, fetchStatus } = useSignUp();

  // Clerk emails a code before the account exists, so the form has two phases.
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const busy = fetchStatus === "fetching";
  const canSubmitDetails =
    emailAddress.trim().length > 0 && username.trim().length > 0 && password.length > 0 && !busy;
  const canSubmitCode = code.trim().length > 0 && !busy;

  const submitDetails = async () => {
    if (!canSubmitDetails) return;
    setFormError(null);

    // Username is required by the Clerk instance, so it is sent up front rather
    // than collected in a second step after verification.
    const { error } = await signUp.password({
      emailAddress: emailAddress.trim(),
      username: username.trim(),
      password,
    });
    if (error) {
      setFormError(authErrorMessage(error, "We could not create that account."));
      return;
    }

    const { error: sendError } = await signUp.verifications.sendEmailCode();
    if (sendError) {
      setFormError(authErrorMessage(sendError, "We could not send the verification email."));
      return;
    }

    setAwaitingCode(true);
  };

  const submitCode = async () => {
    if (!canSubmitCode) return;
    setFormError(null);

    const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (error) {
      setFormError(authErrorMessage(error, "That code was not accepted. Check it and try again."));
      return;
    }

    if (signUp.status !== "complete") {
      setFormError("Your account needs more details than this app collects yet.");
      return;
    }

    // Root layout watches the session, so it navigates on its own once this
    // resolves.
    const { error: finalizeError } = await signUp.finalize();
    if (finalizeError) setFormError(authErrorMessage(finalizeError));
  };

  const startOver = async () => {
    await signUp.reset();
    setAwaitingCode(false);
    setCode("");
    setFormError(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[type.eyebrow, styles.ash]}>Atelier</Text>

          {awaitingCode ? (
            <>
              <Text style={[type.hero, styles.title]}>Check your</Text>
              <Text style={type.heroItalic}>inbox.</Text>
              <Text style={[type.body, styles.lede]}>
                We sent a code to {emailAddress.trim()}. Enter it to finish creating your account.
              </Text>

              <View style={styles.fields}>
                <AuthField
                  label="Verification code"
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  onSubmitEditing={submitCode}
                  returnKeyType="go"
                />
              </View>

              {formError ? <Text style={[type.small, styles.error]}>{formError}</Text> : null}

              <View style={styles.submit}>
                <Button label={busy ? "Verifying…" : "Verify and continue"} onPress={submitCode} disabled={!canSubmitCode} />
              </View>

              <Pressable onPress={startOver} style={styles.startOver}>
                <Text style={[type.caps, styles.ash]}>Use a different email</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[type.hero, styles.title]}>Start your</Text>
              <Text style={type.heroItalic}>wardrobe.</Text>
              <Text style={[type.body, styles.lede]}>
                An account keeps your pieces and your colour analysis together.
              </Text>

              <View style={styles.fields}>
                <AuthField
                  label="Email"
                  value={emailAddress}
                  onChangeText={setEmailAddress}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
                <View style={styles.fieldGap}>
                  <AuthField
                    label="Username"
                    value={username}
                    onChangeText={setUsername}
                    placeholder="How you appear in the app"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username-new"
                    textContentType="username"
                  />
                </View>
                <View style={styles.fieldGap}>
                  <AuthField
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="At least 8 characters"
                    autoCapitalize="none"
                    autoComplete="new-password"
                    secureTextEntry
                    textContentType="newPassword"
                    onSubmitEditing={submitDetails}
                    returnKeyType="go"
                  />
                </View>
              </View>

              {formError ? <Text style={[type.small, styles.error]}>{formError}</Text> : null}

              <View style={styles.submit}>
                <Button
                  label={busy ? "Creating…" : "Create account"}
                  onPress={submitDetails}
                  disabled={!canSubmitDetails}
                />
              </View>

              <View style={styles.switch}>
                <Text style={type.small}>Already have an account?</Text>
                <Link href="/(auth)/sign-in" style={styles.link}>
                  <Text style={[type.caps, styles.linkLabel]}>Sign in</Text>
                </Link>
              </View>
            </>
          )}
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
  lede: { marginTop: spacing.lg, maxWidth: 300 },
  fields: { marginTop: spacing.xxxl },
  fieldGap: { marginTop: spacing.xl + spacing.xs },
  error: { marginTop: spacing.xl, color: colors.ember },
  submit: { marginTop: spacing.xxxl },
  startOver: { marginTop: spacing.xl, alignSelf: "flex-start" },
  switch: { marginTop: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.md },
  link: { paddingVertical: spacing.xs },
  linkLabel: { color: colors.ink },
});
