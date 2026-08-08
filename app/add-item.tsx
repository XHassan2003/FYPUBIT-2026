import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { GarmentSilhouette } from "@/components/GarmentSilhouette";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { colors, fonts, gutter, inkAlpha, paperAlpha, spacing, type } from "@/constants/theme";
import { CATEGORIES, Category, OCCASIONS, Occasion } from "@/data/mockWardrobe";
import { useWardrobe } from "@/store/useWardrobe";

const SWATCHES: { hex: string; name: string }[] = [
  { hex: "#FFFFFF", name: "white" },
  { hex: "#F1E9DA", name: "cream" },
  { hex: "#D8D2C4", name: "stone" },
  { hex: "#8A9A80", name: "sage" },
  { hex: "#6B6E4E", name: "olive" },
  { hex: "#B08968", name: "camel" },
  { hex: "#A9784F", name: "tan" },
  { hex: "#3B4A6B", name: "indigo" },
  { hex: "#3A3A3A", name: "charcoal" },
  { hex: "#1C1B19", name: "black" },
];

export default function AddItemScreen() {
  const addItem = useWardrobe((state) => state.addItem);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<Category>("tops");
  const [swatch, setSwatch] = useState(SWATCHES[0]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [image, setImage] = useState<string | undefined>();

  const canSubmit = name.trim().length > 0 && occasions.length > 0;

  const toggleOccasion = (occasion: Occasion) =>
    setOccasions((prev) => (prev.includes(occasion) ? prev.filter((item) => item !== occasion) : [...prev, occasion]));

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
      // This is where OpenCV colour-extraction + YOLO categorisation would run
      // once a real photo comes in — see README "Where the real AI plugs in".
    }
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
          <Pressable onPress={() => setImage(undefined)} style={styles.removePhoto}>
            <Text style={[type.caps, styles.ash]}>Remove photo</Text>
          </Pressable>
        ) : null}
      </View>

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
