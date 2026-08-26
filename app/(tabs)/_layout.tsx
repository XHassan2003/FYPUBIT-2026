import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, inkAlpha, paperAlpha, shadow, type } from "@/constants/theme";

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Virtual try-on sits in the middle, raised out of the bar, because it is what
 * the app is for. The other four are where you keep and arrange things.
 *
 * `index` is the try-on landing and is deliberately absent from this list — it
 * is the raised button, not one of the four.
 */
const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: "wardrobe", label: "Wardrobe", icon: "shirt-outline" },
  { name: "style", label: "Style", icon: "sunny-outline" },
  { name: "builder", label: "Looks", icon: "color-wand-outline" },
  { name: "profile", label: "Profile", icon: "person-outline" },
];

/** Width reserved for the raised button, so the four tabs sit either side. */
const CENTRE_WIDTH = 92;

/** Indicator inset from each edge of its tab, matching the web's inset-x-4. */
const INDICATOR_INSET = 16;

function AtelierTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // The tabs are no longer equal-width — the raised button takes a fixed slot
  // out of the middle — so the indicator is measured rather than calculated.
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});

  const activeName = state.routes[state.index]?.name;
  const activeLayout = activeName ? layouts[activeName] : undefined;
  const onTryOn = activeName === "index";

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: withTiming(activeLayout ? 1 : 0, { duration: 180 }),
    width: Math.max((activeLayout?.width ?? 0) - INDICATOR_INSET * 2, 0),
    transform: [
      {
        translateX: withSpring((activeLayout?.x ?? 0) + INDICATOR_INSET, {
          stiffness: 480,
          damping: 40,
        }),
      },
    ],
  }));

  const centreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(onTryOn ? 1 : 0.94, { stiffness: 420, damping: 30 }) }],
  }));

  const go = (name: string) => {
    const route = state.routes.find((candidate) => candidate.name === name);
    if (!route) return;

    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (activeName !== name && !event.defaultPrevented) navigation.navigate(name);
  };

  const measure = (name: string) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setLayouts((prev) =>
      prev[name]?.x === x && prev[name]?.width === width ? prev : { ...prev, [name]: { x, width } }
    );
  };

  const tab = (name: string) => {
    const config = TABS.find((candidate) => candidate.name === name);
    if (!config) return null;

    const focused = activeName === name;

    return (
      <Pressable
        key={name}
        onPress={() => go(name)}
        onLayout={measure(name)}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        accessibilityLabel={config.label}
        style={styles.tab}
      >
        <Ionicons name={config.icon} size={17} color={focused ? colors.ink : colors.ash} />
        <Text style={[type.tab, { color: focused ? colors.ink : colors.ash }]}>{config.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom || 12 }]}>
      <Animated.View style={[styles.indicator, indicatorStyle]} pointerEvents="none" />

      {tab("wardrobe")}
      {tab("style")}

      <View style={styles.centreSlot}>
        <Pressable
          onPress={() => go("index")}
          accessibilityRole="button"
          accessibilityState={onTryOn ? { selected: true } : {}}
          accessibilityLabel="Virtual try-on"
          style={styles.centre}
        >
          <Animated.View style={[styles.centreDisc, centreStyle]}>
            <Ionicons name="sparkles" size={21} color={colors.paper} />
          </Animated.View>
          <Text style={[type.tab, styles.centreLabel, { color: onTryOn ? colors.ink : colors.ash }]}>
            Try-on
          </Text>
        </Pressable>
      </View>

      {tab("builder")}
      {tab("profile")}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <AtelierTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="wardrobe" />
      <Tabs.Screen name="style" />
      <Tabs.Screen name="builder" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: paperAlpha.a92,
    borderTopWidth: 1,
    borderTopColor: inkAlpha.a10,
    paddingTop: 14,
  },
  indicator: { position: "absolute", top: 0, left: 0, height: 1, backgroundColor: colors.ink },
  tab: { flex: 1, alignItems: "center", gap: 6 },

  centreSlot: { width: CENTRE_WIDTH },
  // Lifted out of the bar. `overflow: visible` is the default on iOS but the
  // bar has no clipping either, so the disc is free to sit above its edge.
  centre: { position: "absolute", left: 0, right: 0, top: -38, alignItems: "center" },
  centreDisc: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
    ...shadow.lift,
  },
  centreLabel: { marginTop: 8 },
});
