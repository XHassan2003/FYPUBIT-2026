import {
  BodoniModa_400Regular,
  BodoniModa_400Regular_Italic,
  BodoniModa_500Medium,
  BodoniModa_600SemiBold,
} from "@expo-google-fonts/bodoni-moda";
import { Jost_300Light, Jost_400Regular, Jost_500Medium, Jost_600SemiBold } from "@expo-google-fonts/jost";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { requirePublishableKey } from "@/constants/auth";
import { colors } from "@/constants/theme";
import { useWardrobe } from "@/store/useWardrobe";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

/**
 * Lives inside ClerkProvider so it can read the session. Everything behind
 * `isSignedIn` is unreachable while signed out, and the auth screens are
 * unreachable while signed in — expo-router drops the history entries either
 * way, so the back gesture cannot cross the boundary.
 */
function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoaded]);

  // Holding the splash until Clerk has read its token cache avoids showing the
  // sign-in screen for a frame to someone who is already signed in.
  if (!isLoaded) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" />
        {/* Both modals draw their own headers, so the Stack supplies the
            presentation and nothing else. */}
        <Stack.Screen name="add-item" options={{ presentation: "modal" }} />
        <Stack.Screen name="color-quiz" options={{ presentation: "modal" }} />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      {/* Deliberately outside both guards: the Google redirect deep-links back
          in during the switch from signed out to signed in, so it has to be
          routable either way. */}
      <Stack.Screen name="sso-callback" options={{ animation: "none" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BodoniModa_400Regular,
    BodoniModa_400Regular_Italic,
    BodoniModa_500Medium,
    BodoniModa_600SemiBold,
    Jost_300Light,
    Jost_400Regular,
    Jost_500Medium,
    Jost_600SemiBold,
  });

  // Reading the store from AsyncStorage is async. Holding the splash until it
  // finishes means the app never flashes the seed wardrobe before the saved one
  // arrives. The initial value covers hydration that finished before mount.
  const [hydrated, setHydrated] = useState(() => useWardrobe.persist.hasHydrated());

  useEffect(() => useWardrobe.persist.onFinishHydration(() => setHydrated(true)), []);

  if (!fontsLoaded || !hydrated) {
    return null;
  }

  return (
    <ClerkProvider publishableKey={requirePublishableKey()} tokenCache={tokenCache}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootNavigator />
      </GestureHandlerRootView>
      <StatusBar style="dark" />
    </ClerkProvider>
  );
}
