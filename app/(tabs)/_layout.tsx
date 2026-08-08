import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, inkAlpha, paperAlpha, type } from "@/constants/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, IconName> = {
  index: "sunny-outline",
  wardrobe: "shirt-outline",
  builder: "color-wand-outline",
  profile: "person-outline",
};

const LABELS: Record<string, string> = {
  index: "Today",
  wardrobe: "Wardrobe",
  builder: "Builder",
  profile: "Profile",
};

/** Indicator inset from each edge of its tab, matching the web's inset-x-5. */
const INDICATOR_INSET = 20;

function AtelierTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);

  const tabWidth = barWidth / state.routes.length;

  const indicatorStyle = useAnimatedStyle(() => ({
    width: Math.max(tabWidth - INDICATOR_INSET * 2, 0),
    transform: [
      {
        translateX: withSpring(state.index * tabWidth + INDICATOR_INSET, { stiffness: 480, damping: 40 }),
      },
    ],
  }));

  const onLayout = (event: LayoutChangeEvent) => setBarWidth(event.nativeEvent.layout.width);

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom || 12 }]} onLayout={onLayout}>
      {barWidth > 0 ? <Animated.View style={[styles.indicator, indicatorStyle]} /> : null}

      {state.routes.map((route, index) => {
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={LABELS[route.name] ?? route.name}
            style={styles.tab}
          >
            <Ionicons
              name={ICONS[route.name] ?? "ellipse-outline"}
              size={17}
              color={focused ? colors.ink : colors.ash}
            />
            <Text style={[type.tab, { color: focused ? colors.ink : colors.ash }]}>
              {LABELS[route.name] ?? route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <AtelierTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="wardrobe" />
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
});
