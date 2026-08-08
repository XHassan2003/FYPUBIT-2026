import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { GarmentSilhouette } from "@/components/GarmentSilhouette";
import { SectionHeader } from "@/components/SectionHeader";
import { colors, radii, spacing, type } from "@/constants/theme";
import { CATEGORIES, Category, OCCASIONS, Occasion } from "@/data/mockWardrobe";
import { useWardrobe } from "@/store/useWardrobe";

const SWATCHES: { name: string; hex: string }[] = [
  { name: "white", hex: "#FFFFFF" },
  { name: "black", hex: "#1C1B19" },
  { name: "cream", hex: "#F1E9DA" },
  { name: "stone", hex: "#D8D2C4" },
  { name: "indigo", hex: "#3B4A6B" },
  { name: "olive", hex: "#6B6E4E" },
  { name: "camel", hex: "#B08968" },
  { name: "plum", hex: "#6B2545" },
  { name: "sage", hex: "#8A9A80" },
  { name: "gold", hex: "#B98B3E" },
];

export default function AddItemScreen() {
  const { addItem } = useWardrobe();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<Category>("tops");
  const [swatch, setSwatch] = useState(SWATCHES[0]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [image, setImage] = useState<string | undefined>();

  const toggleOccasion = (occasion: Occasion) => {
    setOccasions((prev) => (prev.includes(occasion) ? prev.filter((item) => item !== occasion) : [...prev, occasion]));
  };

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

  const canSave = name.trim().length > 0 && occasions.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    addItem({ name: name.trim(), brand: brand.trim() || undefined, category, color: swatch.hex, colorName: swatch.name, occasions, image });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.photoPicker} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.photo} contentFit="cover" />
          ) : (
            <>
              <GarmentSilhouette category={category} color={swatch.hex} size={72} />
              <Text style={[type.smallMedium, styles.photoHint]}>Tap to add a photo</Text>
            </>
          )}
        </Pressable>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name this piece"
          placeholderTextColor={colors.inkFaint}
          style={styles.input}
        />

        <TextInput
          value={brand}
          onChangeText={setBrand}
          placeholder="Brand (optional)"
          placeholderTextColor={colors.inkFaint}
          style={[styles.input, styles.brandInput]}
        />

        <View style={styles.section}>
          <SectionHeader title="CATEGORY" />
          <View style={styles.chipRow}>
            {CATEGORIES.map((item) => (
              <Chip key={item} label={item} selected={item === category} onPress={() => setCategory(item)} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="COLOUR" />
          <View style={styles.swatchRow}>
            {SWATCHES.map((item) => (
              <Pressable
                key={item.name}
                onPress={() => setSwatch(item)}
                style={[styles.swatch, { backgroundColor: item.hex }, swatch.name === item.name && styles.swatchSelected]}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="OCCASIONS" />
          <View style={styles.chipRow}>
            {OCCASIONS.map((item) => (
              <Chip key={item} label={item} selected={occasions.includes(item)} onPress={() => toggleOccasion(item)} />
            ))}
          </View>
        </View>

        <Button label="Add to wardrobe" onPress={handleSave} disabled={!canSave} style={styles.save} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  photoPicker: {
    height: 180,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    overflow: "hidden",
  },
  photo: { width: "100%", height: "100%" },
  photoHint: { color: colors.inkMuted },
  brandInput: { marginTop: spacing.sm },
  input: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: colors.ink,
  },
  section: { marginTop: spacing.xl },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  swatchSelected: { borderWidth: 3, borderColor: colors.violet },
  save: { marginTop: spacing.xxl },
});
