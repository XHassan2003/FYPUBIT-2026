import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { GarmentSilhouette } from "@/components/GarmentSilhouette";
import { PhotoAnalysis } from "@/components/PhotoAnalysis";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { colors, fonts, gutter, inkAlpha, paperAlpha, spacing, type } from "@/constants/theme";
import { CATEGORIES, Category, OCCASIONS, Occasion } from "@/data/mockWardrobe";
import { SWATCHES } from "@/data/swatches";
import { useGarmentAnalysis } from "@/hooks/useGarmentAnalysis";
import { GarmentAnalysis, useWardrobe } from "@/store/useWardrobe";

export default function AddItemScreen() {
  const addItem = useWardrobe((state) => state.addItem);
  const { analyse, analysing, error: analysisError, clearError } = useGarmentAnalysis();

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<Category>("tops");
  const [swatch, setSwatch] = useState(SWATCHES[0]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [image, setImage] = useState<string | undefined>();
  const [analysis, setAnalysis] = useState<GarmentAnalysis | null>(null);

  const canSubmit = name.trim().length > 0 && occasions.length > 0;

  const toggleOccasion = (occasion: Occasion) =>
    setOccasions((prev) => (prev.includes(occasion) ? prev.filter((item) => item !== occasion) : [...prev, occasion]));

  /**
   * Everything the analyser returns is a suggestion, and only ever fills a
   * field the user has not already answered. Overwriting a deliberate choice
   * with a guess is the one thing this must not do.
   */
  const applyAnalysis = (found: GarmentAnalysis) => {
    if (found.name && !name.trim()) setName(found.name);
    if (found.brand && !brand.trim()) setBrand(found.brand);
    if (found.category) setCategory(found.category);
    if (found.occasions.length > 0 && occasions.length === 0) setOccasions(found.occasions);

    // The service already snapped the detected colour to one of SWATCHES, so
    // this is a lookup rather than a match.
    if (found.color) {
      const matched = SWATCHES.find((option) => option.hex === found.color);
      if (matched) setSwatch(matched);
    }
  };

  const runAnalysis = async (uri: string) => {
    setAnalysis(null);
    const found = await analyse(uri);
    if (!found) return;
    setAnalysis(found);
    applyAnalysis(found);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
    setImage(uri);
    clearError();
    await runAnalysis(uri);
  };

  const removePhoto = () => {
    setImage(undefined);
    setAnalysis(null);
    clearError();
  };

  const submit = () => {
    if (!canSubmit) return;
    addItem({
      name: name.trim(),
      brand: brand.trim() || undefined,
      category,
      color: swatch.hex,
      colorName: swatch.name,
      occasions,
      image,
    });
    router.back();
  };

  return (
    <Screen
      variant="modal"
      header={
        <View style={styles.modalHeader}>
          <Text style={type.eyebrow}>Add a piece</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="close" size={20} color={inkAlpha.a70} />
          </Pressable>
        </View>
      }
    >
      <View style={styles.photoSection}>
        <Pressable onPress={pickImage} style={({ pressed }) => [styles.photoPicker, pressed && styles.pressed]}>
          {image ? (
            <Image source={{ uri: image }} style={styles.photo} contentFit="cover" transition={300} />
          ) : (
            <View style={styles.photoPrompt}>
              <GarmentSilhouette category={category} color={swatch.hex} size={78} />
              <View style={styles.photoHint}>
                <Ionicons name="camera-outline" size={13} color={colors.smoke} />
                <Text style={[type.caps, styles.photoHintLabel]}>Add a photo</Text>
              </View>
            </View>
          )}
        </Pressable>
        {image ? (
          <Pressable onPress={removePhoto} style={styles.removePhoto}>
            <Text style={[type.caps, styles.ash]}>Remove photo</Text>
          </Pressable>
        ) : null}
      </View>

      <PhotoAnalysis
        analysing={analysing}
        error={analysisError}
        result={analysis}
        onRetry={image ? () => runAnalysis(image) : undefined}
      />

      <View style={styles.fields}>
        <View>
          <Text style={[type.eyebrow, styles.ash]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Wool overcoat"
            placeholderTextColor={colors.ash}
            style={styles.field}
          />
        </View>
        <View style={styles.fieldSpacer}>
          <Text style={[type.eyebrow, styles.ash]}>Brand</Text>
          <TextInput
            value={brand}
            onChangeText={setBrand}
            placeholder="Optional"
            placeholderTextColor={colors.ash}
            style={styles.field}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.gutter}>
          <SectionHeader title="Category" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CATEGORIES.map((item) => (
            <Chip key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />
          ))}
        </ScrollView>
      </View>

      <View style={[styles.section, styles.gutter]}>
        <SectionHeader title="Colour" />
        <View style={styles.swatchGrid}>
          {SWATCHES.map((item) => {
            const active = swatch.name === item.name;
            return (
              <Pressable
                key={item.name}
                onPress={() => setSwatch(item)}
                accessibilityRole="button"
                accessibilityLabel={item.name}
                accessibilityState={{ selected: active }}
                style={[styles.swatchFrame, active && styles.swatchFrameActive]}
              >
                <View style={[styles.swatch, { backgroundColor: item.hex }]} />
              </Pressable>
            );
          })}
        </View>
        <Text style={[type.small, styles.swatchName]}>{swatch.name}</Text>
      </View>

      <View style={[styles.section, styles.gutter]}>
        <SectionHeader title="Occasions" />
        <View style={styles.occasionRow}>
          {OCCASIONS.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={occasions.includes(item)}
              onPress={() => toggleOccasion(item)}
            />
          ))}
        </View>
        {occasions.length === 0 ? (
          <Text style={[type.small, styles.ash, styles.occasionHint]}>
            Pick at least one so we know when to style it.
          </Text>
        ) : null}
      </View>

      <View style={[styles.submit, styles.gutter]}>
        <Button label="Add to wardrobe" onPress={submit} disabled={!canSubmit} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: gutter },
  ash: { color: colors.ash },
  pressed: { opacity: 0.7 },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: gutter,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: inkAlpha.a10,
    backgroundColor: paperAlpha.a95,
  },

  photoSection: { paddingHorizontal: gutter, paddingTop: spacing.xl + spacing.xs },
  photoPicker: {
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: inkAlpha.a20,
    backgroundColor: "rgba(233, 227, 217, 0.4)",
    overflow: "hidden",
  },
  photo: { width: "100%", height: "100%" },
  photoPrompt: { alignItems: "center" },
  photoHint: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  photoHintLabel: { color: colors.smoke },
  removePhoto: { marginTop: spacing.md, alignSelf: "flex-start" },

  fields: { paddingHorizontal: gutter, marginTop: spacing.xxxl - spacing.md },
  fieldSpacer: { marginTop: spacing.xl + spacing.xs },
  // Underline-only input: the display face carries the value, the rule carries
  // the affordance.
  field: {
    marginTop: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: inkAlpha.a15,
    paddingBottom: 10,
    paddingTop: spacing.xs,
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },

  section: { marginTop: spacing.xxxl - spacing.sm },
  chipRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: gutter, paddingTop: spacing.lg },

  swatchGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: spacing.lg },
  // The selection ring is always laid out — only its colour changes — so
  // picking a swatch never reflows the grid.
  swatchFrame: { borderWidth: 1, borderColor: "transparent", padding: 2 },
  swatchFrameActive: { borderColor: colors.ink },
  swatch: { width: 42, height: 42, borderWidth: 1, borderColor: inkAlpha.a15 },
  swatchName: { marginTop: spacing.md },

  occasionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  occasionHint: { marginTop: spacing.md },

  submit: { marginTop: spacing.xxxl },
});
