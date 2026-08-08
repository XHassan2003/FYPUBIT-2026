import { Image, ImageSource } from "expo-image";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { colors, gutter, spacing, type } from "@/constants/theme";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  image?: ImageSource;
  style?: ViewStyle;
}

export function EmptyState({ title, message, actionLabel, onAction, image, style }: EmptyStateProps) {
  return (
    <Animated.View entering={FadeInDown.duration(500)} style={[styles.wrap, style]}>
      {image ? (
        <View style={styles.imageFrame}>
          <Image source={image} style={styles.image} contentFit="cover" transition={400} />
        </View>
      ) : null}
      <Text style={[type.h3, styles.title]}>{title}</Text>
      <Text style={[type.body, styles.message]}>{message}</Text>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingHorizontal: spacing.xxl, paddingVertical: spacing.xxxl },
  imageFrame: { width: 160, height: 160, marginBottom: spacing.xxl, backgroundColor: colors.sand, overflow: "hidden" },
  image: { width: "100%", height: "100%", opacity: 0.9 },
  title: { textAlign: "center" },
  message: { marginTop: spacing.md, textAlign: "center", maxWidth: 260 },
  action: { marginTop: spacing.xxl, width: "100%", maxWidth: 240, paddingHorizontal: gutter },
});
