import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, inkAlpha, spacing, type } from "@/constants/theme";

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

/** Eyebrow, a hairline that eats the remaining width, and an optional action. */
export function SectionHeader({ title, action, onAction, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <Text style={type.eyebrow}>{title}</Text>
      <View style={styles.rule} />
      {action ? (
        <Pressable onPress={onAction} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
          <Text style={[type.caps, styles.action]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  rule: { flex: 1, height: 1, backgroundColor: inkAlpha.a12 },
  action: { color: colors.smoke },
  pressed: { opacity: 0.6 },
});
