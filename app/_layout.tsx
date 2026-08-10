import {
  BodoniModa_400Regular,
  BodoniModa_400Regular_Italic,
  BodoniModa_500Medium,
  BodoniModa_600SemiBold,
} from "@expo-google-fonts/bodoni-moda";
import { Jost_300Light, Jost_400Regular, Jost_500Medium, Jost_600SemiBold } from "@expo-google-fonts/jost";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { colors } from "@/constants/theme";
import { useWardrobe } from "@/store/useWardrobe";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

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

  const ready = fontsLoaded && hydrated;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen name="(tabs)" />
        {/* Both modals draw their own headers, so the Stack supplies the
            presentation and nothing else. */}
        <Stack.Screen name="add-item" options={{ presentation: "modal" }} />
        <Stack.Screen name="color-quiz" options={{ presentation: "modal" }} />
      </Stack>
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}
