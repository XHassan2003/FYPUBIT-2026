import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SectionHeader } from "@/components/SectionHeader";
import { colors, gradients, radii, spacing, type } from "@/constants/theme";
import { COLOR_SEASONS } from "@/data/colorSeasons";
import { Profile, useWardrobe } from "@/store/useWardrobe";

const PREFERENCE_LABELS: { key: keyof Profile["preferences"]; label: string }[] = [
  { key: "notifications", label: "Daily outfit reminders" },
  { key: "useMetric", label: "Use metric measurements" },
  { key: "includeAccessories", label: "Include accessories in suggestions" },
];

const MEASUREMENT_LABELS: { key: keyof Profile["measurements"]; label: string }[] = [
  { key: "height", label: "Height" },
  { key: "chest", label: "Chest" },
  { key: "waist", label: "Waist" },
  { key: "hips", label: "Hips" },
  { key: "shoeSize", label: "Shoe size" },
];

export default function ProfileScreen() {
  const { profile, togglePreference, setAvatarUri } = useWardrobe();
  const season = profile.colorSeason ? COLOR_SEASONS[profile.colorSeason] : undefined;

  const pickSelfie = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={pickSelfie}>
            <LinearGradient colors={gradients.avatarRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                {profile.avatarUri ? (
                  <Image source={{ uri: profile.avatarUri }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarInitial}>{profile.name.charAt(0)}</Text>
                )}
              </View>
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={14} color={colors.card} />
              </View>
            </LinearGradient>
          </Pressable>
          <Text style={type.h1}>{profile.name}</Text>
          <Text style={[type.small, styles.avatarHint]}>Tap your photo to personalize the app</Text>
        </View>

        <View style={styles.section}>
          <SectionHeader title="YOUR COLOR DNA" action={season ? "Retake" : undefined} onAction={() => router.push("/color-quiz")} />
          {season ? (
            <View style={styles.card}>
              <View style={styles.seasonRow}>
                <View>
                  <Text style={type.h3}>{season.name}</Text>
                  <Text style={[type.small, styles.seasonTagline]}>{season.tagline}</Text>
                </View>
                <View style={styles.paletteRow}>
                  {season.palette.slice(0, 4).map((hex) => (
                    <View key={hex} style={[styles.swatch, { backgroundColor: hex }]} />
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => router.push("/color-quiz")}>
              <LinearGradient colors={gradients.feature} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quizCard}>
                <Text style={styles.quizTitle}>Discover your colors and style</Text>
                <Text style={styles.quizBody}>Take the 4-question quiz to unlock your palette.</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="STYLE TAGS" />
          <View style={styles.tagRow}>
            {profile.styleTags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={type.smallMedium}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="MEASUREMENTS" />
          <View style={styles.card}>
            {MEASUREMENT_LABELS.map((row, index) => (
              <View key={row.key} style={[styles.measurementRow, index === MEASUREMENT_LABELS.length - 1 && styles.noBorder]}>
                <Text style={type.body}>{row.label}</Text>
                <Text style={type.bodyMedium}>{profile.measurements[row.key]}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="PREFERENCES" />
          <View style={styles.card}>
            {PREFERENCE_LABELS.map((row, index) => (
              <View key={row.key} style={[styles.prefRow, index === PREFERENCE_LABELS.length - 1 && styles.noBorder]}>
                <Text style={type.body}>{row.label}</Text>
                <Switch
                  value={profile.preferences[row.key]}
                  onValueChange={() => togglePreference(row.key)}
                  trackColor={{ false: colors.border, true: colors.violet }}
                  thumbColor={colors.card}
                />
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
  header: { alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  avatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: { color: colors.violet, fontFamily: "Fraunces_600SemiBold", fontSize: 28 },
  avatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.violetDeep,
    borderWidth: 2,
    borderColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: { color: colors.inkMuted },
  section: { marginTop: spacing.xl },
  seasonRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  seasonTagline: { marginTop: spacing.xs },
  paletteRow: { flexDirection: "row", gap: spacing.xs },
  swatch: { width: 24, height: 24, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border },
  quizCard: { borderRadius: radii.lg, padding: spacing.lg, gap: spacing.xs },
  quizTitle: { fontFamily: "Fraunces_600SemiBold", fontSize: 18, lineHeight: 24, color: colors.onGradient },
  quizBody: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18, color: colors.onGradient, opacity: 0.9 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: {
    backgroundColor: colors.violetMuted,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  measurementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  prefRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  noBorder: { borderBottomWidth: 0 },
});
