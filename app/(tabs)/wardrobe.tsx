import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { ItemTile } from "@/components/ItemTile";
import { MatchModal } from "@/components/MatchModal";
import { colors, radii, spacing, type } from "@/constants/theme";
import { CATEGORIES, Category, WardrobeItem } from "@/data/mockWardrobe";
import { useWardrobe } from "@/store/useWardrobe";

export default function WardrobeScreen() {
  const { items, removeItem } = useWardrobe();
  const [filter, setFilter] = useState<Category | "all">("all");
  const [matchItem, setMatchItem] = useState<WardrobeItem | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.category === filter)),
    [items, filter]
  );

  const handleLongPress = (id: string, name: string) => {
    Alert.alert("Remove piece", `Remove "${name}" from your wardrobe?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeItem(id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={type.h1}>Wardrobe</Text>
        <Pressable style={styles.fab} onPress={() => router.push("/add-item")}>
          <Ionicons name="add" size={24} color={colors.paper} />
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.chipRow}>
            <Chip label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
            {CATEGORIES.map((category) => (
              <Chip key={category} label={category} selected={filter === category} onPress={() => setFilter(category)} />
            ))}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Nothing here yet"
            message="Add a piece to start building your wardrobe."
            actionLabel="Add Piece"
            onAction={() => router.push("/add-item")}
          />
        }
        renderItem={({ item }) => (
          <ItemTile item={item} onPress={() => setMatchItem(item)} onLongPress={() => handleLongPress(item.id, item.name)} />
        )}
      />

      <MatchModal item={matchItem} onClose={() => setMatchItem(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  row: { justifyContent: "space-between", marginBottom: spacing.lg },
});
