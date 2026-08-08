import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, inkAlpha, spacing, type } from "@/constants/theme";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
  /** Rendered to the left of the label — an icon element, sized by the caller. */
  icon?: React.ReactNode;
}

export function Button({ label, onPress, variant = "primary", disabled, style, icon }: ButtonProps) {
  const isGhost = variant === "ghost";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        isGhost ? styles.ghostBase : styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        // The web build scales to 0.985 on press; on touch a slight fade reads
        // better than a transform this shallow.
        pressed && !disabled && (isGhost ? styles.ghostPressed : styles.pressed),
        disabled && (variant === "primary" ? styles.primaryDisabled : styles.outlineDisabled),
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[
          type.capsButton,
          variant === "primary" && styles.primaryLabel,
          isGhost && styles.ghostLabel,
          disabled && styles.disabledLabel,
        ]}
      >
        {label}
      </Text>
      {isGhost ? <View style={[styles.underline, disabled && styles.underlineDisabled]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  primary: { backgroundColor: colors.ink },
  secondary: { borderWidth: 1, borderColor: inkAlpha.a25, backgroundColor: "transparent" },
  pressed: { opacity: 0.86 },
  primaryDisabled: { backgroundColor: colors.line },
  outlineDisabled: { borderColor: colors.line },
  primaryLabel: { color: colors.paper },
  disabledLabel: { color: colors.ash },

  ghostBase: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.sm },
  ghostPressed: { opacity: 0.6 },
  ghostLabel: { color: colors.smoke },
  underline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -6,
    height: 1,
    backgroundColor: inkAlpha.a25,
  },
  underlineDisabled: { backgroundColor: colors.line },
  icon: { alignItems: "center", justifyContent: "center" },
});
