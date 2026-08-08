import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "@/constants/theme";

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={type.eyebrow}>{title}</Text>
      {action ? (
        <Text style={[type.smallMedium, styles.action]} onPress={onAction}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  action: { color: colors.violet },
});
