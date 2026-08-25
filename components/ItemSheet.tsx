import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, gutter, inkAlpha, spacing, type } from "@/constants/theme";
import { COLOR_SEASONS } from "@/data/colorSeasons";
import { WardrobeItem } from "@/data/mockWardrobe";
import { MatchResult, useWardrobe } from "@/store/useWardrobe";
import { Button } from "./Button";
import { GarmentThumb } from "./GarmentThumb";
import { Sheet } from "./Sheet";

interface ItemSheetProps {
  item: WardrobeItem | null;
  onClose: () => void;
}

export function ItemSheet({ item, onClose }: ItemSheetProps) {
  const profile = useWardrobe((state) => state.profile);
  const matchItemToProfile = useWardrobe((state) => state.matchItemToProfile);
  const removeItem = useWardrobe((state) => state.removeItem);

  const [result, setResult] = useState<MatchResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const barWidth = useSharedValue(0);

  useEffect(() => {
    setResult(null);
    setChecking(false);
    setConfirmRemove(false);
    barWidth.value = 0;
  }, [item?.id, barWidth]);

  const season = profile.colorSeason ? COLOR_SEASONS[profile.colorSeason] : undefined;

  // The pause used to be theatre — a 650ms timer over a synchronous lookup.
  // The scoring is a real round-trip to the service now, so the wait is the
  // actual wait. It resolves in well under `API_TIMEOUT_MS` either way: the
  // store falls back to on-device scoring rather than leaving this spinning.
  const runMatch = async () => {
    if (!item) return;
    setChecking(true);
    try {
      const next = await matchItemToProfile(item);
      setResult(next);
      barWidth.value = withTiming(next.score, { duration: 900 });
    } finally {
      setChecking(false);
    }
  };

  const barStyle = useAnimatedStyle(() => ({ width: `${barWidth.value}%` }));

  return (
    <Sheet open={!!item} onClose={onClose} label="Item details">
      {item ? (
        <View style={styles.body}>
          <View style={styles.headRow}>
            <GarmentThumb item={item} style={styles.thumb} silhouetteSize={64} />
            <View style={styles.headMeta}>
              <Text style={[type.eyebrow, styles.ash]}>{item.brand ?? "Unbranded"}</Text>
              <Text style={[type.h3, styles.title]}>{item.name}</Text>
              <View style={styles.metaRow}>
                <View style={[styles.swatch, { backgroundColor: item.color }]} />
                <Text style={type.small}>{item.colorName}</Text>
                <View style={styles.metaDivider} />
                <Text style={type.small}>{item.category}</Text>
              </View>
              <View style={styles.tagRow}>
                {item.occasions.map((occasion) => (
                  <View key={occasion} style={styles.tag}>
                    <Text style={[type.caps, styles.tagLabel]}>{occasion}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.rule} />

          <View style={styles.section}>
            <Text style={[type.eyebrow, styles.ash]}>Colour analysis</Text>

            {!season ? (
              <View style={styles.block}>
                <Text style={type.h4}>Take the colour quiz to see if this piece belongs to you.</Text>
                <Text style={[type.body, styles.blockBody]}>
                  Four questions. We map your undertone, contrast and depth into a seasonal palette.
                </Text>
                <View style={styles.cta}>
                  <Button
                    label="Discover your colours"
                    onPress={() => {
                      onClose();
                      router.push("/color-quiz");
                    }}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.block}>
                <Text style={type.body}>
                  Measured against <Text style={styles.inkInline}>{season.name}</Text> — {season.tagline.toLowerCase()}.
                </Text>

                {result ? (
                  <Animated.View entering={FadeInDown.duration(450)} style={styles.resultCard}>
                    <View style={styles.resultTop}>
                      <View style={styles.resultCopy}>
                        <Text style={[type.eyebrow, styles.ash]}>
                          {result.isMatch ? "In your palette" : "Off palette"}
                        </Text>
                        <Text style={[type.h3, styles.resultHeadline]}>
                          {result.isMatch ? "This one is yours." : "Wear it with intent."}
                        </Text>
                      </View>
                      <Text style={styles.score}>
                        {result.score}
                        <Text style={styles.percent}>%</Text>
                      </Text>
                    </View>

                    <View style={styles.barTrack}>
                      <Animated.View
                        style={[
                          styles.barFill,
                          { backgroundColor: result.isMatch ? colors.forest : colors.ember },
                          barStyle,
                        ]}
                      />
                    </View>

                    <Text style={[type.small, styles.resultNote]}>
                      {result.isMatch
                        ? `${item.colorName} sits inside your season's compatible range.`
                        : `${item.colorName} falls outside your season — pair it away from the face.`}
                    </Text>
                  </Animated.View>
                ) : (
                  <View style={styles.cta}>
                    <Button
                      label={checking ? "Analysing…" : "Check if it matches me"}
                      onPress={runMatch}
                      disabled={checking}
                      icon={<Ionicons name="sparkles-outline" size={14} color={colors.paper} />}
                    />
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={styles.rule} />

          <View style={styles.removeRow}>
            {confirmRemove ? (
              <View style={styles.confirmRow}>
                <Text style={[type.small, styles.confirmText]}>Remove this piece from your wardrobe?</Text>
                <Pressable onPress={() => setConfirmRemove(false)} style={styles.keepButton}>
                  <Text style={type.caps}>Keep</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    removeItem(item.id);
                    onClose();
                  }}
                  style={styles.removeButton}
                >
                  <Text style={[type.caps, styles.removeLabel]}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setConfirmRemove(true)}
                style={({ pressed }) => [styles.removeTrigger, pressed && styles.pressed]}
              >
                <Ionicons name="trash-outline" size={13} color={colors.ash} />
                <Text style={[type.caps, styles.ash]}>Remove from wardrobe</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: gutter, paddingBottom: spacing.xxxl },
  headRow: { flexDirection: "row", gap: spacing.xl },
  thumb: { width: 104, height: 132 },
  headMeta: { flex: 1, paddingTop: spacing.xs },
  ash: { color: colors.ash },
  title: { marginTop: spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  swatch: { width: 12, height: 12, borderWidth: 1, borderColor: inkAlpha.a15 },
  metaDivider: { width: 1, height: 12, backgroundColor: inkAlpha.a15 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.md },
  tag: { borderWidth: 1, borderColor: inkAlpha.a12, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  tagLabel: { fontSize: 9, letterSpacing: 1.6, color: colors.smoke },

  rule: { height: 1, backgroundColor: inkAlpha.a10, marginTop: spacing.xxl },
  section: { marginTop: spacing.xl },
  block: { marginTop: spacing.lg },
  blockBody: { marginTop: spacing.sm },
  cta: { marginTop: spacing.xl },
  inkInline: { color: colors.ink },

  resultCard: {
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: inkAlpha.a12,
    backgroundColor: colors.card,
    padding: spacing.xl,
  },
  resultTop: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  resultCopy: { flex: 1, paddingRight: spacing.md },
  resultHeadline: { marginTop: spacing.sm, fontSize: 22, lineHeight: 26 },
  score: { fontFamily: type.h1.fontFamily, fontSize: 44, lineHeight: 44, color: colors.ink },
  percent: { fontSize: 16, lineHeight: 16 },
  barTrack: { height: 3, backgroundColor: inkAlpha.a8, marginTop: spacing.lg },
  barFill: { height: "100%" },
  resultNote: { marginTop: spacing.lg },

  removeRow: { marginTop: spacing.xl },
  removeTrigger: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pressed: { opacity: 0.6 },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  confirmText: { flex: 1 },
  keepButton: { borderWidth: 1, borderColor: inkAlpha.a20, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  removeButton: { backgroundColor: colors.ember, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  removeLabel: { color: colors.paper },
});
