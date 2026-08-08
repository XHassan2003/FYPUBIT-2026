import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, gradients, radii, spacing, type } from "@/constants/theme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  style?: ViewStyle;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = "primary", style, disabled }: ButtonProps) {
  if (variant === "primary") {
    return (
      <Pressable onPress={onPress} disabled={disabled} style={[disabled && styles.disabled, style]}>
        {({ pressed }) => (
          <LinearGradient
            colors={gradients.primaryButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.base, pressed && styles.pressed]}
          >
            <Text style={[type.bodyMedium, styles.primaryLabel]}>{label}</Text>
          </LinearGradient>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[type.bodyMedium, variant === "secondary" && styles.secondaryLabel, variant === "ghost" && styles.ghostLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: "transparent" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  primaryLabel: { color: colors.card },
  secondaryLabel: { color: colors.ink },
  ghostLabel: { color: colors.violet },
});
