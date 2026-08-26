import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Button } from "@/components/Button";
import { GarmentThumb } from "@/components/GarmentThumb";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { colors, gutter, inkAlpha, paperAlpha, spacing, type } from "@/constants/theme";
import { Category, WardrobeItem } from "@/data/mockWardrobe";
import { useWardrobe } from "@/store/useWardrobe";

const STAGE = require("@/assets/images/editorial/builder-stage.jpg");

const RAILS: { category: Category; label: string }[] = [
  { category: "tops", label: "Tops" },
  { category: "bottoms", label: "Bottoms" },
  { category: "shoes", label: "Shoes" },
];

export default function BuilderScreen() {
  const items = useWardrobe((state) => state.items);
  const saveOutfit = useWardrobe((state) => state.saveOutfit);

  const [selection, setSelection] = useState<Partial<Record<Category, WardrobeItem>>>({});
  const [saved, setSaved] = useState(false);

  const chosen = useMemo(
    () => RAILS.map(({ category }) => selection[category]).filter((item): item is WardrobeItem => Boolean(item)),
    [selection]
  );

  const wearable = useMemo(() => chosen.filter((item) => item.image), [chosen]);

  const pick = (item: WardrobeItem) =>
    setSelection((prev) => ({
      ...prev,
      [item.category]: prev[item.category]?.id === item.id ? undefined : item,
    }));

  const surprise = () => {
    const next: Partial<Record<Category, WardrobeItem>> = {};
    RAILS.forEach(({ category }) => {
      const pool = items.filter((item) => item.category === category);
      if (pool.length > 0) next[category] = pool[Math.floor(Math.random() * pool.length)];
    });
    setSelection(next);
  };

  const save = () => {
    if (chosen.length === 0) return;
    saveOutfit(
      chosen.map((item) => item.id),
      "casual"
    );
    setSelection({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[type.eyebrow, styles.ash]}>Compose</Text>
        <Text style={[type.h1, styles.title]}>Builder</Text>
        <Text style={[type.body, styles.lede]}>
          Layer a look piece by piece, or let the shuffle make the first move.
        </Text>
      </View>

      <View style={styles.stageSection}>
        <View style={styles.stage}>
          <Image source={STAGE} style={styles.stageImage} contentFit="cover" transition={500} />
          <View style={styles.stageRow}>
            {RAILS.map(({ category, label }) => {
              const item = selection[category];
              return (
                <View key={category} style={styles.stageSlot}>
                  {item ? (
                    <Animated.View key={item.id} entering={FadeInDown.duration(400)}>
                      <GarmentThumb item={item} style={styles.stageThumb} silhouetteSize={54} />
                      <Text style={[type.h5, styles.stageName]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </Animated.View>
                  ) : (
                    <Animated.View entering={FadeIn.duration(300)} style={styles.stageEmpty}>
                      <Text style={[type.eyebrow, styles.ash, styles.stageEmptyLabel]}>{label}</Text>
                    </Animated.View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.actions}>
          <View style={styles.action}>
            <Button
              label="Surprise me"
              variant="secondary"
              onPress={surprise}
              icon={<Ionicons name="shuffle" size={14} color={colors.ink} />}
            />
          </View>
          <View style={styles.action}>
            <Button label="Save look" onPress={save} disabled={chosen.length === 0} />
          </View>
        </View>

        {/* The try-on takes one piece, so the first of the look that has a
            photograph goes through as the starting selection — it can be
            changed on the way. A silhouette tells the generator nothing. */}
        <View style={styles.tryOn}>
          <Button
            label="Try it on"
            variant="secondary"
            disabled={wearable.length === 0}
            onPress={() =>
              router.push({
                pathname: "/try-on",
                params: { item: wearable[0]?.id },
              })
            }
            icon={<Ionicons name="sparkles-outline" size={14} color={colors.ink} />}
          />
          {chosen.length > 0 && wearable.length === 0 ? (
            <Text style={[type.small, styles.tryOnNote]}>
              None of these pieces have a photo yet — add one and you can see it on yourself.
            </Text>
          ) : null}
        </View>

        {saved ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.savedRow}>
            <Ionicons name="checkmark" size={13} color={colors.forest} />
            <Text style={[type.caps, styles.savedLabel]}>Look saved to your archive</Text>
          </Animated.View>
        ) : null}
      </View>

      {RAILS.map(({ category, label }) => {
        const rail = items.filter((item) => item.category === category);
        return (
          <View key={category} style={styles.railSection}>
            <View style={styles.gutter}>
              <SectionHeader title={label} />
            </View>
            {rail.length === 0 ? (
              <Text style={[type.body, styles.gutter, styles.railEmpty]}>
                No {label.toLowerCase()} catalogued yet.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railRow}>
                {rail.map((item) => {
                  const isSelected = selection[category]?.id === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => pick(item)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      style={styles.railItem}
                    >
                      <View style={[styles.railFrame, isSelected && styles.railFrameSelected]}>
                        <GarmentThumb item={item} style={styles.railThumb} silhouetteSize={46} />
                        {isSelected ? (
                          <View style={styles.railCheck}>
                            <Ionicons name="checkmark" size={12} color={colors.paper} />
                          </View>
                        ) : null}
                      </View>
                      <Text style={[type.small, styles.railName]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: gutter },
  ash: { color: colors.ash },

  header: { paddingHorizontal: gutter, paddingTop: spacing.xxl },
  title: { marginTop: 10 },
  lede: { marginTop: 14, maxWidth: 320 },

  stageSection: { marginTop: spacing.xl + spacing.xs, paddingHorizontal: gutter },
  stage: { borderWidth: 1, borderColor: inkAlpha.a10, overflow: "hidden" },
  stageImage: { ...StyleSheet.absoluteFillObject, opacity: 0.7 },
  stageRow: { flexDirection: "row", gap: spacing.md, padding: spacing.lg, minHeight: 248 },
  stageSlot: { flex: 1 },
  stageThumb: { width: "100%", height: 176 },
  stageName: { marginTop: spacing.sm, fontSize: 12, lineHeight: 16 },
  stageEmpty: {
    height: 176,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: inkAlpha.a20,
    backgroundColor: paperAlpha.a50,
  },
  stageEmptyLabel: { transform: [{ rotate: "90deg" }] },

  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  action: { flex: 1 },
  tryOn: { marginTop: spacing.md },
  tryOnNote: { marginTop: spacing.md },
  savedRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md },
  savedLabel: { color: colors.forest },

  railSection: { marginTop: spacing.xxxl },
  railEmpty: { marginTop: spacing.lg },
  railRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: gutter, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  railItem: { width: 104 },
  // Ring always laid out, colour-only change — the rail never shifts on select.
  railFrame: { borderWidth: 1, borderColor: "transparent", padding: 2 },
  railFrameSelected: { borderColor: colors.ink },
  railThumb: { width: "100%", height: 132 },
  railCheck: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
  railName: { marginTop: spacing.sm },
});
