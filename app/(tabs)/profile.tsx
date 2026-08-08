import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { Toggle } from "@/components/Toggle";
import { colors, gradients, gutter, inkAlpha, shadow, spacing, type } from "@/constants/theme";
import { COLOR_SEASONS } from "@/data/colorSeasons";
import { useWardrobe } from "@/store/useWardrobe";

const COVER = require("@/assets/images/editorial/profile-cover.jpg");

const PREFERENCES: { key: "notifications" | "useMetric" | "includeAccessories"; label: string; hint: string }[] = [
  { key: "notifications", label: "Daily styling nudge", hint: "A look suggestion each morning" },
  { key: "useMetric", label: "Metric measurements", hint: "Centimetres instead of inches" },
  {
    key: "includeAccessories",
    label: "Include accessories",
    hint: "Finish suggested looks with jewellery and bags",
  },
];

export default function ProfileScreen() {
  const profile = useWardrobe((state) => state.profile);
  const togglePreference = useWardrobe((state) => state.togglePreference);
  const setAvatarUri = useWardrobe((state) => state.setAvatarUri);

  const season = profile.colorSeason ? COLOR_SEASONS[profile.colorSeason] : undefined;

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const measurements = [
    { label: "Height", value: profile.measurements.height },
    { label: "Chest", value: profile.measurements.chest },
    { label: "Waist", value: profile.measurements.waist },
    { label: "Hips", value: profile.measurements.hips },
    { label: "Shoe size", value: profile.measurements.shoeSize },
  ];

  return (
    <Screen>
      <View style={styles.cover}>
        <Image source={COVER} style={styles.coverImage} contentFit="cover" transition={500} />
        <LinearGradient colors={gradients.paperFade} style={styles.coverFade} pointerEvents="none" />
      </View>

      <View style={styles.identity}>
        <Pressable
          onPress={pickAvatar}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
        >
          {profile.avatarUri ? (
            <Image source={{ uri: profile.avatarUri }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: profile.avatarColor }]}>
              <Text style={styles.avatarInitial}>{profile.name.slice(0, 1)}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            <Ionicons name="camera-outline" size={10} color={colors.paper} />
            <Text style={[type.tab, styles.avatarBadgeLabel]}>Change</Text>
          </View>
        </Pressable>

        <View style={styles.identityText}>
          <Text style={[type.eyebrow, styles.ash]}>Your profile</Text>
          <Text style={[type.h2, styles.name]}>{profile.name}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Colour DNA"
          action={season ? "Retake" : undefined}
          onAction={() => router.push("/color-quiz")}
        />
        {season ? (
          <Animated.View entering={FadeInDown.duration(500)} style={styles.dnaCard}>
            <View style={styles.dnaCardHead}>
              <Text style={type.h3}>{season.name}</Text>
              <Text style={[type.small, styles.dnaTagline]}>{season.tagline}</Text>
            </View>
            <View style={styles.paletteRow}>
              {season.palette.map((hex) => (
                <View key={hex} style={[styles.paletteSwatch, { backgroundColor: hex }]} />
              ))}
            </View>
          </Animated.View>
        ) : (
          <Pressable
            onPress={() => router.push("/color-quiz")}
            style={({ pressed }) => [styles.dnaPrompt, pressed && styles.pressed]}
          >
            <Text style={type.h4}>Not analysed yet</Text>
            <Text style={[type.body, styles.dnaPromptBody]}>
              Four questions unlock your seasonal palette and the match checker on every piece.
            </Text>
            <View style={styles.dnaPromptCta}>
              <Text style={type.caps}>Take the quiz</Text>
              <Ionicons name="arrow-forward" size={13} color={colors.ink} />
            </View>
          </Pressable>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Style tags" />
        <View style={styles.tagRow}>
          {profile.styleTags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={[type.caps, styles.tagLabel]}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Measurements" />
        <View style={styles.list}>
          {measurements.map(({ label, value }) => (
            <View key={label} style={styles.measurementRow}>
              <Text style={type.body}>{label}</Text>
              <Text style={[type.h5, styles.measurementValue]}>{value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Preferences" />
        <View style={styles.list}>
          {PREFERENCES.map(({ key, label, hint }) => (
            <View key={key} style={styles.preferenceRow}>
              <View style={styles.preferenceText}>
                <Text style={type.label}>{label}</Text>
                <Text style={[type.small, styles.preferenceHint]}>{hint}</Text>
              </View>
              <Toggle checked={profile.preferences[key]} onChange={() => togglePreference(key)} label={label} />
            </View>
          ))}
        </View>
      </View>

      <Text style={[type.footnote, styles.footnote]}>Atelier — your wardrobe, considered.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ash: { color: colors.ash },
  pressed: { opacity: 0.85 },

  cover: { height: 168, width: "100%", overflow: "hidden" },
  coverImage: { width: "100%", height: "100%" },
  coverFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 80 },

  // Lifts the avatar up across the cover's lower edge.
  identity: { marginTop: -56, paddingHorizontal: gutter, flexDirection: "row", alignItems: "flex-end", gap: spacing.lg },
  avatar: {
    width: 96,
    height: 96,
    borderWidth: 1,
    borderColor: colors.paper,
    backgroundColor: colors.sand,
    overflow: "hidden",
    ...shadow.lift,
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: type.h1.fontFamily, fontSize: 34, lineHeight: 40, color: colors.paper },
  avatarBadge: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: 5,
    backgroundColor: inkAlpha.a70,
  },
  avatarBadgeLabel: { fontSize: 8, color: colors.paper },
  identityText: { paddingBottom: spacing.xs },
  name: { marginTop: spacing.sm },

  section: { marginTop: spacing.xxxl, paddingHorizontal: gutter },

  dnaCard: { marginTop: spacing.xl, borderWidth: 1, borderColor: inkAlpha.a10, backgroundColor: colors.card },
  dnaCardHead: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  dnaTagline: { marginTop: 6 },
  paletteRow: { flexDirection: "row", marginTop: spacing.xl },
  paletteSwatch: { flex: 1, height: 40 },

  dnaPrompt: {
    marginTop: spacing.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: inkAlpha.a20,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  dnaPromptBody: { marginTop: spacing.sm, maxWidth: 320 },
  dnaPromptCta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  tag: { borderWidth: 1, borderColor: inkAlpha.a15, paddingHorizontal: 14, paddingVertical: spacing.sm },
  tagLabel: { color: colors.smoke },

  list: { marginTop: spacing.md },
  measurementRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: inkAlpha.a8,
    paddingVertical: 14,
  },
  measurementValue: { fontSize: 16, lineHeight: 20 },
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: inkAlpha.a8,
    paddingVertical: spacing.lg,
  },
  preferenceText: { flex: 1 },
  preferenceHint: { marginTop: spacing.xs },

  footnote: { marginTop: spacing.xxxl, textAlign: "center", paddingHorizontal: gutter },
});
