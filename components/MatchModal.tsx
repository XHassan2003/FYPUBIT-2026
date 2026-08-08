import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, gradients, radii, spacing, type } from "@/constants/theme";
import { WardrobeItem } from "@/data/mockWardrobe";
import { useWardrobe } from "@/store/useWardrobe";
import { Button } from "./Button";
import { GarmentThumb } from "./GarmentThumb";

interface MatchModalProps {
  item: WardrobeItem | null;
  onClose: () => void;
}

export function MatchModal({ item, onClose }: MatchModalProps) {
  const { profile, matchItemToProfile } = useWardrobe();
  const [result, setResult] = useState<{ isMatch: boolean; score: number } | null>(null);

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  const handleCheck = () => {
    if (!item) return;
    setResult(matchItemToProfile(item));
  };

  return (
    <Modal visible={Boolean(item)} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        {item ? (
          <View style={styles.sheet}>
            <View style={styles.preview}>
              <GarmentThumb item={item} size={96} />
              {item.brand ? <Text style={type.eyebrow}>{item.brand}</Text> : null}
              <Text style={type.h3}>{item.name}</Text>
              <Text style={type.small}>{item.colorName}</Text>
            </View>

            {!profile.colorSeason ? (
              <View style={styles.prompt}>
                <Text style={[type.body, styles.promptText]}>Take the color quiz first so we know your palette.</Text>
                <Button
                  label="Discover your colors"
                  onPress={() => {
                    handleClose();
                    router.push("/color-quiz");
                  }}
                />
              </View>
            ) : result ? (
              <LinearGradient
                colors={result.isMatch ? gradients.hero : [colors.inkFaint, colors.inkMuted]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.resultBanner}
              >
                <Text style={styles.resultTitle}>{result.isMatch ? "Yes! It's a match" : "Not quite your season"}</Text>
                <Text style={styles.resultScore}>{result.score}% match</Text>
              </LinearGradient>
            ) : (
              <Button label="Check if it matches me" onPress={handleCheck} />
            )}

            <Button label="Close" variant="ghost" onPress={handleClose} style={styles.closeButton} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(24, 19, 33, 0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  preview: { alignItems: "center", gap: spacing.xs },
  prompt: { gap: spacing.md, alignItems: "center" },
  promptText: { textAlign: "center", color: colors.inkMuted },
  resultBanner: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
  },
  resultTitle: { fontFamily: "Fraunces_600SemiBold", fontSize: 20, lineHeight: 26, color: colors.onGradient },
  resultScore: { fontFamily: "Inter_500Medium", fontSize: 14, color: colors.onGradient, opacity: 0.9 },
  closeButton: { alignSelf: "center" },
});
