import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { colors, fonts, inkAlpha, spacing, type } from "@/constants/theme";

interface AuthFieldProps extends TextInputProps {
  label: string;
}

/**
 * Underline-only input matching the Add Piece form: the display face carries the
 * value, the rule carries the affordance.
 */
export function AuthField({ label, style, ...inputProps }: AuthFieldProps) {
  return (
    <View>
      <Text style={[type.eyebrow, styles.label]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.ash}
        style={[styles.input, style]}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.ash },
  input: {
    marginTop: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: inkAlpha.a15,
    paddingBottom: 10,
    paddingTop: spacing.xs,
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },
});
