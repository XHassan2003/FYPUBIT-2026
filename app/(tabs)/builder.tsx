import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { GarmentThumb } from "@/components/GarmentThumb";
import { SectionHeader } from "@/components/SectionHeader";
import { colors, radii, shadow, spacing, type } from "@/constants/theme";
import { Category, Occasion, WardrobeItem } from "@/data/mockWardrobe";
import { useWardrobe } from "@/store/useWardrobe";

const RAILS: { category: Category; title: string }[] = [
  { category: "tops", title: "TOPS" },
  { category: "bottoms", title: "BOTTOMS" },
  { category: "shoes", title: "SHOES" },
];

export default function BuilderScreen() {
  const { items, saveOutfit } = useWardrobe();
  const [selection, setSelection] = useState<Partial<Record<Category, WardrobeItem>>>({});

  const byCategory = useMemo(() => {
    const map: Record<Category, WardrobeItem[]> = { tops: [], bottoms: [], outerwear: [], shoes: [], accessories: [] };
    for (const item of items) map[item.category].push(item);
    return map;
  }, [items]);

  const pick = (item: WardrobeItem) => {
    setSelection((prev) => ({ ...prev, [item.category]: prev[item.category]?.id === item.id ? undefined : item }));
  };

  const surpriseMe = () => {
    const next: Partial<Record<Category, WardrobeItem>> = {};
    for (const rail of RAILS) {
      const pool = byCategory[rail.category];
      if (pool.length > 0) next[rail.category] = pool[Math.floor(Math.random() * pool.length)];
    }
    setSelection(next);
  };

  const selectedItems = RAILS.map((rail) => selection[rail.category]).filter((item): item is WardrobeItem => Boolean(item));

  const handleSave = () => {
    if (selectedItems.length === 0) return;
    saveOutfit(
      selectedItems.map((item) => item.id),
      "casual" as Occasion
    );
    setSelection({});
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={type.h1}>Outfit Builder</Text>
        <Text style={[type.body, styles.subtitle]}>Pick a piece from each rail, or let us surprise you.</Text>

        <View style={styles.preview}>
          {selectedItems.length === 0 ? (
            <Text style={[type.body, styles.muted]}>Your look will show up here.</Text>
          ) : (
            <View style={styles.previewRow}>
              {selectedItems.map((item) => (
                <View key={item.id} style={styles.previewPiece}>
                  <GarmentThumb item={item} size={80} />
                  {item.brand ? (
                    <Text style={type.eyebrow} numberOfLines={1}>
                      {item.brand}
                    </Text>
                  ) : null}
                  <Text style={type.small} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {RAILS.map((rail) => (
          <View key={rail.category} style={styles.section}>
            <SectionHeader title={rail.title} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railRow}>
              {byCategory[rail.category].map((item) => {
                const isSelected = selection[rail.category]?.id === item.id;
                return (
                  <Pressable key={item.id} style={[styles.railItem, isSelected && styles.railItemSelected]} onPress={() => pick(item)}>
                    <GarmentThumb item={item} size={56} />
                    {item.brand ? (
                      <Text style={type.eyebrow} numberOfLines={1}>
                        {item.brand}
                      </Text>
                    ) : null}
                    <Text style={type.small} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ))}

        <View style={styles.actions}>
          <Button label="Surprise me" variant="secondary" onPress={surpriseMe} style={styles.actionButton} />
          <Button label="Save look" onPress={handleSave} disabled={selectedItems.length === 0} style={styles.actionButton} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  subtitle: { marginTop: spacing.xs, color: colors.inkMuted },
  preview: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    minHeight: 150,
    justifyContent: "center",
    ...shadow.sm,
  },
  muted: { color: colors.inkMuted, textAlign: "center" },
  previewRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.lg },
  previewPiece: { alignItems: "center", width: 88, gap: 2 },
  section: { marginTop: spacing.xl },
  railRow: { gap: spacing.sm },
  railItem: {
    width: 96,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: "center",
    gap: 2,
    ...shadow.sm,
  },
  railItemSelected: { borderWidth: 2, borderColor: colors.violet },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
  actionButton: { flex: 1 },
});
