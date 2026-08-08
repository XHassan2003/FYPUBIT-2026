import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, type } from "@/constants/theme";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Text style={type.h3}>{title}</Text>
      <Text style={[type.body, styles.message]}>{message}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  message: { textAlign: "center", marginTop: spacing.xs, color: colors.inkMuted },
  button: { marginTop: spacing.lg },
});
