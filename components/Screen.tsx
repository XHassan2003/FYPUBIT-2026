import { ReactNode } from "react";
import { ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Edge, SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/constants/theme";

const TOP_ONLY: Edge[] = ["top"];

interface ScreenProps {
  children: ReactNode;
  /**
   * `tab` leaves room under the content for the tab bar; `modal` is presented
   * by the Stack, so it only needs its own bottom inset.
   */
  variant?: "tab" | "modal";
  /** Pinned above the scroll view — the sticky bars the web build used. */
  header?: ReactNode;
  /** Rendered over the scroll view, e.g. the wardrobe's removal confirmation. */
  overlay?: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  /** Indices of direct children that should pin to the top as they scroll past. */
  stickyHeaderIndices?: number[];
}

export function Screen({
  children,
  variant = "tab",
  header,
  overlay,
  scroll = true,
  contentStyle,
  stickyHeaderIndices,
}: ScreenProps) {
  return (
    // Bottom is left to the tab bar (tab screens) or the Stack's sheet (modals).
    <SafeAreaView style={styles.safe} edges={TOP_ONLY}>
      <Animated.View entering={FadeIn.duration(320)} style={styles.flex}>
        {header}
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[variant === "tab" ? styles.tabContent : styles.modalContent, contentStyle]}
            showsVerticalScrollIndicator={false}
            stickyHeaderIndices={stickyHeaderIndices}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, contentStyle]}>{children}</View>
        )}
      </Animated.View>
      {overlay}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  tabContent: { paddingBottom: spacing.xxxl * 2 },
  modalContent: { paddingBottom: spacing.xxxl },
});
