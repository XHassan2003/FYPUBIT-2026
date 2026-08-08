import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Chip } from "@/components/Chip";
import { GarmentThumb } from "@/components/GarmentThumb";
import { SectionHeader } from "@/components/SectionHeader";
import { colors, gradients, radii, shadow, spacing, type } from "@/constants/theme";
import { COLOR_SEASONS } from "@/data/colorSeasons";
import { OCCASIONS, Occasion, WardrobeItem } from "@/data/mockWardrobe";
import { useWardrobe } from "@/store/useWardrobe";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function TodayScreen() {
  const { items, outfits, profile, suggestOutfit } = useWardrobe();
  const [occasion, setOccasion] = useState<Occasion>("work");
  const [look, setLook] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSuggest = async (nextOccasion: Occasion) => {
    setOccasion(nextOccasion);
    setLoading(true);
    const result = await suggestOutfit(nextOccasion);
    setLook(result);
    setLoading(false);
  };

  const stats = useMemo(
    () => [
      { label: "Pieces", value: items.length },
      { label: "Saved looks", value: outfits.length },
      { label: "Style tags", value: profile.styleTags.length },
    ],
    [items.length, outfits.length, profile.styleTags.length]
  );

  const season = profile.colorSeason ? COLOR_SEASONS[profile.colorSeason] : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroGreeting}>
            {greeting()}, {profile.name}
          </Text>
          <Text style={styles.heroSubtitle}>What are you dressing for today?</Text>
        </LinearGradient>

        <View style={styles.chipRow}>
          {OCCASIONS.map((item) => (
            <Chip key={item} label={item} selected={item === occasion} onPress={() => handleSuggest(item)} />
          ))}
        </View>

        <View style={styles.section}>
          <SectionHeader title="TODAY'S LOOK" action="Shuffle" onAction={() => handleSuggest(occasion)} />
          <View style={styles.card}>
            {loading ? (
              <Text style={type.body}>Styling…</Text>
            ) : look.length === 0 ? (
              <Text style={[type.body, styles.muted]}>Tap an occasion above to get a suggestion.</Text>
            ) : (
              <View style={styles.lookRow}>
                {look.map((piece) => (
                  <View key={piece.id} style={styles.lookPiece}>
                    <GarmentThumb item={piece} size={72} />
                    {piece.brand ? (
                      <Text style={type.eyebrow} numberOfLines={1}>
                        {piece.brand}
                      </Text>
                    ) : null}
                    <Text style={type.small} numberOfLines={1}>
                      {piece.name}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={season ? "YOUR COLOR DNA" : "DISCOVER YOUR STYLE"} />
          <Pressable onPress={() => router.push("/color-quiz")}>
            <LinearGradient colors={gradients.feature} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.promoCard}>
              {season ? (
                <>
                  <Text style={styles.promoTitle}>{season.name}</Text>
                  <Text style={styles.promoBody}>{season.tagline}. Tap to retake the quiz.</Text>
                </>
              ) : (
                <>
                  <Text style={styles.promoTitle}>Discover your personal colors and style</Text>
                  <Text style={styles.promoBody}>Answer a few quick questions to unlock your Color DNA.</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.section}>
          <SectionHeader title="AT A GLANCE" />
          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <Text style={type.h2}>{stat.value}</Text>
                <Text style={type.small}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  hero: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  heroGreeting: { fontFamily: "Fraunces_600SemiBold", fontSize: 28, lineHeight: 34, color: colors.onGradient },
  heroSubtitle: { fontFamily: "Inter_400Regular", fontSize: 15, color: colors.onGradient, opacity: 0.9 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  section: { marginTop: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    minHeight: 120,
    justifyContent: "center",
    ...shadow.sm,
  },
  muted: { color: colors.inkMuted },
  lookRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg },
  lookPiece: { alignItems: "center", width: 80, gap: 2 },
  promoCard: { borderRadius: radii.xl, padding: spacing.xl, gap: spacing.xs },
  promoTitle: { fontFamily: "Fraunces_600SemiBold", fontSize: 20, lineHeight: 26, color: colors.onGradient },
  promoBody: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, color: colors.onGradient, opacity: 0.9 },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
    ...shadow.sm,
  },
});
