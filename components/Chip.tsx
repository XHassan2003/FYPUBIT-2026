import { Pressable, StyleSheet, Text } from "react-native";
import { colors, inkAlpha, spacing, type } from "@/constants/theme";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

export function Chip({ label, selected = false, onPress, disabled }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[type.caps, selected ? styles.selectedLabel : styles.unselectedLabel]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
  },
  selected: { backgroundColor: colors.ink, borderColor: colors.ink },
  unselected: { backgroundColor: "transparent", borderColor: inkAlpha.a15 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  selectedLabel: { color: colors.paper },
  unselectedLabel: { color: colors.smoke },
});
