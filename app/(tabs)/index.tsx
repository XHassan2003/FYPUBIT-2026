import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Chip } from "@/components/Chip";
import { GarmentThumb } from "@/components/GarmentThumb";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { colors, gradients, gutter, inkAlpha, spacing, type } from "@/constants/theme";
import { COLOR_SEASONS } from "@/data/colorSeasons";
import { OCCASIONS, Occasion, WardrobeItem } from "@/data/mockWardrobe";
import { useWardrobe } from "@/store/useWardrobe";

const HERO = require("@/assets/images/editorial/today-hero.jpg");

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function today() {
  const now = new Date();
  return `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

/** Three pulsing plates standing in for the look while it is being composed. */
function LookSkeleton({ index }: { index: number }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    // Offsetting each plate keeps the row breathing rather than blinking.
    opacity.value = withDelay(
      index * 180,
      withRepeat(withSequence(withTiming(0.8, { duration: 700 }), withTiming(0.4, { duration: 700 })), -1, false)
    );
  }, [opacity, index]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.skeleton, style]} />;
}

export default function TodayScreen() {
  const items = useWardrobe((state) => state.items);
  const outfits = useWardrobe((state) => state.outfits);
  const profile = useWardrobe((state) => state.profile);
  const suggestOutfit = useWardrobe((state) => state.suggestOutfit);

  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [look, setLook] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(false);

  const heroScale = useSharedValue(1.08);
  useEffect(() => {
    heroScale.value = withTiming(1, { duration: 1600 });
  }, [heroScale]);
  const heroStyle = useAnimatedStyle(() => ({ transform: [{ scale: heroScale.value }] }));

  const stats = useMemo(
    () => [
      { label: "Pieces", value: items.length },
      { label: "Saved looks", value: outfits.length },
      { label: "Style tags", value: profile.styleTags.length },
    ],
    [items.length, outfits.length, profile.styleTags.length]
  );

  const season = profile.colorSeason ? COLOR_SEASONS[profile.colorSeason] : undefined;

  const handleSuggest = async (next: Occasion) => {
    setOccasion(next);
    setLoading(true);
    const result = await suggestOutfit(next);
    setLook(result);
    setLoading(false);
  };

  return (
    <Screen>
      <View>
        <View style={styles.hero}>
          <Animated.View style={[styles.heroImageWrap, heroStyle]}>
            <Image source={HERO} style={styles.heroImage} contentFit="cover" transition={600} />
          </Animated.View>
          <LinearGradient colors={gradients.paperFade} style={styles.heroFade} pointerEvents="none" />
          <View style={styles.heroTop}>
            <Text style={[type.eyebrow, styles.heroDate]}>{today()}</Text>
            <Text style={styles.wordmark}>Atelier</Text>
          </View>
        </View>

        <View style={styles.headline}>
          <Animated.View entering={FadeInDown.duration(700).delay(150)}>
            <Text style={type.hero}>{greeting()}</Text>
            <Text style={type.heroItalic}>{profile.name}.</Text>
          </Animated.View>
          <Text style={[type.body, styles.lede]}>
            {items.length} pieces in rotation. Tell us where the day takes you and we will put the look together.
          </Text>
        </View>
      </View>

      <View style={styles.occasionSection}>
        <Text style={[type.eyebrow, styles.ash, styles.gutter]}>Dressing for</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          {OCCASIONS.map((item) => (
            <Chip key={item} label={item} selected={occasion === item} onPress={() => handleSuggest(item)} />
          ))}
        </ScrollView>
      </View>

      <View style={[styles.gutter, styles.lookHeader]}>
        <SectionHeader
          title="Today's look"
          action={occasion && !loading ? "Reshuffle" : undefined}
          onAction={() => occasion && handleSuggest(occasion)}
        />
      </View>

      <View style={styles.lookArea}>
        {loading ? (
          <View style={[styles.gutter, styles.skeletonRow]}>
            {[0, 1, 2].map((index) => (
              <LookSkeleton key={index} index={index} />
            ))}
          </View>
        ) : look.length === 0 ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.lookEmpty}>
            <Ionicons name="refresh-outline" size={18} color={colors.ash} />
            <Text style={[type.h4, styles.lookEmptyTitle]}>Nothing styled yet</Text>
            <Text style={[type.small, styles.lookEmptyBody]}>
              Pick an occasion above and we&apos;ll pull a head-to-toe look from your own wardrobe.
            </Text>
          </Animated.View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lookRow}>
            {look.map((piece, index) => (
              <Animated.View
                key={piece.id}
                entering={FadeInDown.duration(550).delay(index * 70)}
                style={styles.lookPiece}
              >
                <View style={styles.lookThumbWrap}>
                  <GarmentThumb item={piece} style={styles.lookThumb} />
                  <View style={styles.lookIndex}>
                    <Text style={type.h5}>{String(index + 1).padStart(2, "0")}</Text>
                  </View>
                </View>
                <Text style={[type.eyebrow, styles.ash, styles.lookBrand]} numberOfLines={1}>
                  {piece.brand ?? piece.category}
                </Text>
                <Text style={[type.h5, styles.lookName]} numberOfLines={2}>
                  {piece.name}
                </Text>
              </Animated.View>
            ))}
          </ScrollView>
        )}
      </View>

      <Pressable
        onPress={() => router.push("/color-quiz")}
        style={({ pressed }) => [styles.dnaBlock, pressed && styles.dnaPressed]}
      >
        <Text style={[type.eyebrow, styles.dnaEyebrow]}>Colour DNA</Text>
        {season ? (
          <>
            <Text style={[type.h2, styles.dnaTitle]}>{season.name}</Text>
            <Text style={[type.small, styles.dnaBody]}>{season.tagline}</Text>
            <View style={styles.paletteRow}>
              {season.palette.map((hex) => (
                <View key={hex} style={[styles.paletteSwatch, { backgroundColor: hex }]} />
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={[type.h2, styles.dnaTitle, styles.dnaHeadline]}>
              Find the colours that were made for you.
            </Text>
            <Text style={[type.small, styles.dnaBody]}>
              A four-question analysis maps your undertone and contrast to a seasonal palette.
            </Text>
          </>
        )}
        <View style={styles.dnaCta}>
          <Text style={[type.caps, styles.dnaCtaLabel]}>{season ? "Retake the analysis" : "Begin the quiz"}</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.paper} />
        </View>
      </Pressable>

      <View style={[styles.gutter, styles.statsSection]}>
        <SectionHeader title="At a glance" />
        <View style={styles.statsRow}>
          {stats.map((stat, index) => (
            <View key={stat.label} style={[styles.stat, index > 0 && styles.statDivided]}>
              <Text style={type.numeral}>{stat.value}</Text>
              <Text style={[type.eyebrow, styles.ash, styles.statLabel]}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={[type.footnote, styles.footnote]}>Dress from what you already own.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: gutter },
  ash: { color: colors.ash },

  hero: { height: 420, width: "100%", overflow: "hidden" },
  heroImageWrap: { ...StyleSheet.absoluteFillObject },
  heroImage: { width: "100%", height: "100%" },
  heroFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 160 },
  heroTop: {
    position: "absolute",
    top: spacing.xl,
    left: gutter,
    right: gutter,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroDate: { color: inkAlpha.a70 },
  wordmark: { fontFamily: type.footnote.fontFamily, fontSize: 13, letterSpacing: 0.6, color: inkAlpha.a70 },

  // Pulls the masthead up over the photograph's fade, as on the web.
  headline: { marginTop: -64, paddingHorizontal: gutter },
  lede: { marginTop: spacing.lg, maxWidth: 300 },

  occasionSection: { marginTop: spacing.xxl },
  chipScroll: { marginTop: 14 },
  chipRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: gutter, paddingBottom: spacing.xs },

  lookHeader: { marginTop: spacing.xxl + spacing.sm },
  lookArea: { marginTop: spacing.xl, minHeight: 268 },
  skeletonRow: { flexDirection: "row", gap: spacing.md },
  skeleton: { height: 236, width: 152, backgroundColor: colors.sand },
  lookEmpty: {
    marginHorizontal: gutter,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: inkAlpha.a15,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
    alignItems: "center",
  },
  lookEmptyTitle: { marginTop: spacing.lg },
  lookEmptyBody: { marginTop: spacing.sm, textAlign: "center", maxWidth: 240 },
  lookRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: gutter, paddingBottom: spacing.sm },
  lookPiece: { width: 152 },
  lookThumbWrap: { position: "relative" },
  lookThumb: { width: "100%", height: 196 },
  lookIndex: {
    position: "absolute",
    left: 0,
    top: 0,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  lookBrand: { marginTop: 10 },
  lookName: { marginTop: spacing.xs },

  dnaBlock: { marginTop: spacing.xxxl, backgroundColor: colors.ink, paddingHorizontal: gutter, paddingVertical: spacing.xxl },
  dnaPressed: { opacity: 0.92 },
  dnaEyebrow: { color: "rgba(243, 240, 234, 0.5)" },
  dnaTitle: { marginTop: spacing.md, color: colors.paper },
  dnaHeadline: { fontSize: 28, lineHeight: 31, maxWidth: 280 },
  dnaBody: { marginTop: 6, color: "rgba(243, 240, 234, 0.6)", maxWidth: 300 },
  paletteRow: { flexDirection: "row", marginTop: spacing.xl },
  paletteSwatch: { flex: 1, height: 32 },
  dnaCta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xl },
  dnaCtaLabel: { color: colors.paper, letterSpacing: 2 },

  statsSection: { marginTop: spacing.xxxl },
  statsRow: { flexDirection: "row", marginTop: spacing.xl },
  stat: { flex: 1 },
  statDivided: { borderLeftWidth: 1, borderLeftColor: inkAlpha.a10, paddingLeft: spacing.xl },
  statLabel: { marginTop: 10 },

  footnote: { marginTop: spacing.xxxl, textAlign: "center", paddingHorizontal: gutter },
});
