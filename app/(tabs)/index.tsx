import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { GarmentThumb } from "@/components/GarmentThumb";
import { Screen } from "@/components/Screen";
import { colors, gutter, inkAlpha, paperAlpha, spacing, type } from "@/constants/theme";
import { useDisplayName } from "@/hooks/useDisplayName";
import { useTryOn } from "@/store/useTryOn";
import { useWardrobe } from "@/store/useWardrobe";

/**
 * Home's own hero. Currently a copy of the Style tab's photograph, standing in
 * until a real one lands — replace the file, not this line, and nothing else
 * has to change.
 *
 * What suits the slot: portrait, a person full length, room at the top for the
 * wordmark. It fills 580pt at full width and the ink gradient covers the lower
 * 78%, so anything below the waist reads as texture behind the headline rather
 * than as subject.
 */
const HERO = require("@/assets/images/editorial/home-hero.jpg");

/** How many pieces the rail offers before it stops being a glance. */
const RAIL_LENGTH = 12;

/**
 * The app's front door, and the way into virtual try-on.
 *
 * It does not run the flow — it shows how far along you already are and hands
 * over at whichever step is still unanswered. The state is in
 * store/useTryOn.ts, shared with app/try-on.tsx, so a photo chosen here is
 * still chosen there.
 */
export default function HomeScreen() {
  const items = useWardrobe((state) => state.items);
  const displayName = useDisplayName();

  const photo = useTryOn((state) => state.photo);
  const itemId = useTryOn((state) => state.itemId);
  const result = useTryOn((state) => state.result);
  const pickPhoto = useTryOn((state) => state.pickPhoto);
  const useSamplePhoto = useTryOn((state) => state.useSamplePhoto);
  const setItemId = useTryOn((state) => state.setItemId);

  // Only pieces with a photograph can be generated from.
  const wearable = useMemo(() => items.filter((piece) => piece.image), [items]);
  const rail = useMemo(() => wearable.slice(0, RAIL_LENGTH), [wearable]);
  const item = useMemo(() => wearable.find((piece) => piece.id === itemId), [wearable, itemId]);

  /** Opens the flow at the first thing still missing. */
  const openFlow = () => {
    const step = !photo ? "photo" : !itemId ? "item" : "confirm";
    router.push({ pathname: "/try-on", params: { step, item: itemId } });
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <Animated.View entering={FadeIn.duration(700)} style={StyleSheet.absoluteFill}>
          <Image source={HERO} style={styles.heroImage} contentFit="cover" transition={700} />
        </Animated.View>
        <LinearGradient
          colors={["transparent", inkAlpha.a70, colors.ink]}
          locations={[0.22, 0.62, 1]}
          style={styles.heroScrim}
          pointerEvents="none"
        />

        <View style={styles.heroTop}>
          <Text style={[type.eyebrow, styles.onDark]}>Atelier</Text>
          <Text style={styles.heroKicker}>Virtual try-on</Text>
        </View>

        <View style={styles.heroFoot}>
          <Animated.View entering={FadeInDown.duration(750).delay(120)}>
            <Text style={[type.hero, styles.heroTitle]}>See it.</Text>
            <Text style={[type.hero, styles.heroTitle]}>Wear it.</Text>
            <Text style={[type.heroItalic, styles.heroTitle]}>Love it.</Text>
          </Animated.View>

          <Animated.Text entering={FadeInDown.duration(700).delay(240)} style={styles.heroBlurb}>
            Try your favourite Atelier looks on yourself before you wear them.
          </Animated.Text>

          <Animated.View entering={FadeInDown.duration(700).delay(340)} style={styles.heroActions}>
            <Pressable
              onPress={openFlow}
              accessibilityRole="button"
              style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
            >
              <Ionicons name="sparkles-outline" size={15} color={colors.ink} />
              <Text style={styles.heroButtonLabel}>Try it on</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.ink} />
            </Pressable>

            <Pressable onPress={() => router.push("/wardrobe")} style={styles.heroLink} hitSlop={6}>
              <Text style={styles.heroLinkLabel}>Explore my wardrobe</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>

      <View style={styles.steps}>
        <Text style={[type.eyebrow, styles.ash]}>Two steps, {displayName}</Text>

        <View style={styles.stepRow}>
          <Text style={styles.stepIndex}>01</Text>
          <View style={styles.stepBody}>
            <Text style={type.h3}>Your photo</Text>
            <Text style={[type.body, styles.stepBlurb]}>
              Take a photo or choose one from your gallery.
            </Text>

            {photo ? (
              <View style={styles.photoReady}>
                <Image source={{ uri: photo }} style={styles.photoThumb} contentFit="cover" transition={300} />
                <View style={styles.photoReadyCopy}>
                  <View style={styles.photoReadyRow}>
                    <Ionicons name="checkmark" size={12} color={colors.forest} />
                    <Text style={styles.photoReadyLabel}>Photo ready</Text>
                  </View>
                  <Pressable onPress={() => pickPhoto("library")} hitSlop={6}>
                    <Text style={styles.underlined}>Change</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.pickRow}>
                <Pressable
                  onPress={() => pickPhoto("camera")}
                  style={({ pressed }) => [styles.pickButton, pressed && styles.pressed]}
                >
                  <Ionicons name="camera-outline" size={13} color={colors.ink} />
                  <Text style={styles.pickLabel}>Take a photo</Text>
                </Pressable>
                <Pressable
                  onPress={() => pickPhoto("library")}
                  style={({ pressed }) => [styles.pickButton, pressed && styles.pressed]}
                >
                  <Ionicons name="images-outline" size={13} color={colors.ink} />
                  <Text style={styles.pickLabel}>Gallery</Text>
                </Pressable>
                <Pressable onPress={useSamplePhoto} style={styles.sample} hitSlop={6}>
                  <Text style={styles.underlined}>Use sample</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.stepRow, styles.stepRowLast]}>
          <Text style={styles.stepIndex}>02</Text>
          <View style={styles.stepBody}>
            <Text style={type.h3}>Your look</Text>
            <Text style={[type.body, styles.stepBlurb]}>Pick a piece from your wardrobe.</Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        style={styles.railScroll}
      >
        {rail.map((option) => {
          const selected = option.id === itemId;
          return (
            <Pressable
              key={option.id}
              onPress={() => setItemId(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={styles.railItem}
            >
              <View style={[styles.railRing, selected && styles.railRingOn]}>
                <View style={styles.railThumbWrap}>
                  <GarmentThumb item={option} style={styles.railThumb} />
                  {selected ? (
                    <Animated.View entering={FadeIn.duration(180)} style={styles.railCheck}>
                      <Ionicons name="checkmark" size={12} color={colors.paper} />
                    </Animated.View>
                  ) : null}
                </View>
              </View>
              <Text style={[type.h5, styles.railName]} numberOfLines={1}>
                {option.name}
              </Text>
              <Text style={styles.railCategory} numberOfLines={1}>
                {option.category}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.cta}>
        <Pressable
          onPress={openFlow}
          accessibilityRole="button"
          style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}
        >
          <Ionicons name="sparkles-outline" size={15} color={colors.paper} />
          <Text style={styles.ctaLabel}>See yourself in it</Text>
        </Pressable>
        <Text style={[type.small, styles.ctaNote]}>
          {photo && item
            ? `${item.name} · ready to preview`
            : "Add a photo and pick a piece — we take it from there."}
        </Text>
      </View>

      {result ? (
        <Pressable
          onPress={() => router.push({ pathname: "/try-on", params: { step: "result" } })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.last, pressed && styles.pressed]}
        >
          <Image source={{ uri: result }} style={styles.lastThumb} contentFit="cover" transition={300} />
          <View style={styles.lastCopy}>
            <Text style={[type.eyebrow, styles.ash]}>Last try-on</Text>
            <Text style={[type.h4, styles.lastTitle]}>Your Atelier look</Text>
          </View>
          <Ionicons name="arrow-forward" size={14} color={colors.ink} />
        </Pressable>
      ) : null}

      <Text style={[type.footnote, styles.footnote]}>See yourself in it before you wear it.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ash: { color: colors.ash },
  onDark: { color: paperAlpha.a85 },
  pressed: { opacity: 0.88 },
  content: { paddingBottom: spacing.xxxl * 2 },

  hero: { height: 580, width: "100%", backgroundColor: colors.ink, overflow: "hidden" },
  heroImage: { width: "100%", height: "100%" },
  heroScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "78%" },
  heroTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: gutter,
    paddingTop: spacing.xl,
  },
  heroKicker: {
    fontFamily: type.caps.fontFamily,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: paperAlpha.a60,
  },
  heroFoot: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: gutter, paddingBottom: spacing.xxl },
  heroTitle: { fontSize: 46, lineHeight: 44, color: colors.paper },
  heroBlurb: {
    marginTop: spacing.lg,
    maxWidth: 260,
    fontFamily: type.body.fontFamily,
    fontSize: 13,
    lineHeight: 20,
    color: paperAlpha.a60,
  },
  heroActions: { marginTop: 28 },
  heroButton: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.paper,
  },
  heroButtonLabel: {
    fontFamily: type.capsButton.fontFamily,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.ink,
  },
  heroLink: { marginTop: spacing.lg, alignSelf: "center" },
  heroLinkLabel: {
    fontFamily: type.caps.fontFamily,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: paperAlpha.a60,
    textDecorationLine: "underline",
  },

  steps: { paddingHorizontal: gutter, paddingTop: 44 },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.lg,
    marginTop: 28,
    borderBottomWidth: 1,
    borderBottomColor: inkAlpha.a10,
    paddingBottom: 28,
  },
  stepRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  stepIndex: { fontFamily: type.h1.fontFamily, fontSize: 13, color: colors.ash },
  stepBody: { flex: 1, minWidth: 0 },
  stepBlurb: { marginTop: 6 },

  photoReady: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.lg },
  photoThumb: { width: 58, height: 74, backgroundColor: colors.sand },
  photoReadyCopy: { gap: spacing.sm },
  photoReadyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  photoReadyLabel: {
    fontFamily: type.caps.fontFamily,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.forest,
  },
  underlined: {
    fontFamily: type.caps.fontFamily,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.ash,
    textDecorationLine: "underline",
  },

  pickRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  pickButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: inkAlpha.a20,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  pickLabel: {
    fontFamily: type.caps.fontFamily,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.ink,
  },
  sample: { paddingVertical: 10, paddingHorizontal: spacing.xs },

  railScroll: { marginTop: spacing.xl },
  rail: { flexDirection: "row", gap: spacing.md, paddingHorizontal: gutter, paddingBottom: spacing.sm },
  railItem: { width: 112 },
  railRing: { borderWidth: 1, borderColor: "transparent", padding: 2 },
  railRingOn: { borderColor: colors.ink },
  railThumbWrap: { aspectRatio: 3 / 4, width: "100%", backgroundColor: colors.sand, overflow: "hidden" },
  railThumb: { width: "100%", height: "100%" },
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
  railCategory: { fontFamily: type.body.fontFamily, fontSize: 10.5, color: colors.smoke },

  cta: { marginTop: spacing.xxl, paddingHorizontal: gutter },
  ctaButton: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.ink,
  },
  ctaLabel: {
    fontFamily: type.capsButton.fontFamily,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.paper,
  },
  ctaNote: { marginTop: 14, textAlign: "center", color: colors.ash },

  last: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: 44,
    marginHorizontal: gutter,
    borderWidth: 1,
    borderColor: inkAlpha.a12,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  lastThumb: { width: 64, height: 84, backgroundColor: colors.sand },
  lastCopy: { flex: 1, minWidth: 0 },
  lastTitle: { marginTop: spacing.sm },

  footnote: { marginTop: 48, textAlign: "center", paddingHorizontal: gutter },
});
