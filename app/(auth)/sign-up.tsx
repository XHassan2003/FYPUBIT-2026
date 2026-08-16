import { useSignUp } from "@clerk/expo";
import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AuthDivider, AuthInput, AuthLayout, AuthNotice, AuthSubmit } from "@/components/AuthLayout";
import { GoogleButton } from "@/components/GoogleButton";
import { authErrorMessage } from "@/constants/auth";
import { auth, fonts, spacing } from "@/constants/theme";

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

  if (awaitingCode) {
    return (
      <AuthLayout
        label="Verify your email"
        title={"Check your inbox\nto continue."}
        subtitle={`We sent a six-digit code to ${emailAddress.trim()}. Enter it to finish setting up your styling profile.`}
        onBack={startOver}
      >
        <AuthInput
          label="Verification code"
          value={code}
          onChangeText={(v) => {
            setCode(v);
            setFormError(null);
          }}
          placeholder="––––––"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          onSubmitEditing={submitCode}
          returnKeyType="go"
          maxLength={6}
          center
        />

        {formError ? <AuthNotice message={formError} tone="error" /> : null}

        <View style={styles.submit}>
          <AuthSubmit
            label="Verify and continue"
            busyLabel="Verifying"
            onPress={submitCode}
            busy={busy}
            disabled={!canSubmitCode}
          />
        </View>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      label="Create an account"
      title={"Begin your styling profile."}
      subtitle="One account keeps your wardrobe, your looks and your colour analysis in one place."
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerLabel}>Already have an account? </Text>
          <Link href="/(auth)/sign-in">
            <Text style={styles.footerLink}>Sign in</Text>
          </Link>
        </View>
      }
    >
      <View style={styles.fields}>
        <AuthInput
          label="Email"
          value={emailAddress}
          onChangeText={(v) => {
            setEmailAddress(v);
            setFormError(null);
          }}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <AuthInput
          label="Username"
          value={username}
          onChangeText={(v) => {
            setUsername(v);
            setFormError(null);
          }}
          placeholder="How you appear in the app"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          textContentType="username"
        />
        <AuthInput
          label="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setFormError(null);
          }}
          placeholder="At least 8 characters"
          autoCapitalize="none"
          autoComplete="new-password"
          secureTextEntry
          textContentType="newPassword"
          onSubmitEditing={submitDetails}
          returnKeyType="go"
          hint="Use at least 8 characters, with a number for extra strength."
        />
      </View>

      {formError ? <AuthNotice message={formError} tone="error" /> : null}

      <View style={styles.submit}>
        <AuthSubmit
          label="Create account"
          busyLabel="Creating account"
          onPress={submitDetails}
          busy={busy}
          disabled={!canSubmitDetails}
        />
      </View>

      <View style={styles.divider}>
        <AuthDivider />
      </View>

      <GoogleButton onError={setFormError} disabled={busy} />

      <Text style={styles.legal}>
        By continuing you agree to let Atelier style you from your own wardrobe.
      </Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 20 },
  submit: { marginTop: 28 },
  divider: { marginVertical: spacing.xl },
  legal: {
    marginTop: spacing.xl,
    textAlign: "center",
    fontFamily: fonts.light,
    fontSize: 11.5,
    lineHeight: 17,
    color: auth.taupeA80,
  },
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
