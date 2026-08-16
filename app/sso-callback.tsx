import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AuthSpinner } from "@/components/AuthLayout";
import { auth, colors } from "@/constants/theme";

/**
 * Where the Google redirect lands.
 *
 * `startSSOFlow` catches the redirect itself through `openAuthSessionAsync`, so
 * nothing here drives the sign-in. But Android also delivers that same URL to
 * the app as a deep link, and expo-router answers it by looking for a
 * `/sso-callback` route — without this file it finds none and shows "Unmatched
 * Route" over the top of a sign-in that is otherwise working.
 *
 * So this is a landing pad, not a step: hold a spinner for the frame it takes
 * Clerk to settle, then hand back to the root layout's guards. They send the
 * user to the tabs if the session took, and back to sign-in if it did not,
 * which means a failed or cancelled Google attempt cannot strand anyone here.
 *
 * It sits outside both `Stack.Protected` blocks in `app/_layout.tsx` because
 * the redirect arrives in the moment between signed out and signed in, and has
 * to be routable in both.
 */
export default function SSOCallbackScreen() {
  const { isLoaded, isSignedIn } = useAuth();

  // Sending everyone to "/" leaves a blank screen when the session did not
  // take: the tabs are guarded out at that moment, so there is nothing at "/"
  // to render. Pick the destination that actually exists in each state.
  if (isLoaded) {
    return <Redirect href={isSignedIn ? "/" : "/(auth)/sign-in"} />;
  }

  return (
    <View style={styles.screen}>
      <AuthSpinner color={auth.taupe} size={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
});
