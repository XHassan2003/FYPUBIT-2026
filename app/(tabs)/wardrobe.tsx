import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { ItemSheet } from "@/components/ItemSheet";
import { ItemTile } from "@/components/ItemTile";
import { Screen } from "@/components/Screen";
import { colors, gutter, inkAlpha, paperAlpha, shadow, spacing, type } from "@/constants/theme";
import { CATEGORIES, Category, WardrobeItem } from "@/data/mockWardrobe";
import { useWardrobe } from "@/store/useWardrobe";

const EMPTY_IMAGE = require("@/assets/images/editorial/wardrobe-empty.jpg");

// width ÷ height per tile position. Cycling through uneven ratios is what stops
// the two columns from lining up into a plain grid.
const RATIOS = [3 / 4, 4 / 5, 1, 3 / 4, 5 / 6, 4 / 5];

export default function WardrobeScreen() {
  const items = useWardrobe((state) => state.items);
  const removeItem = useWardrobe((state) => state.removeItem);

  const [filter, setFilter] = useState<Category | "all">("all");
  const [activeItem, setActiveItem] = useState<WardrobeItem | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<WardrobeItem | null>(null);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.category === filter)),
    [items, filter]
  );

  // Alternate down the list so each column stays roughly the same height.
  const columns = useMemo(() => {
    const left: { item: WardrobeItem; index: number }[] = [];
    const right: { item: WardrobeItem; index: number }[] = [];
    filtered.forEach((item, index) => (index % 2 === 0 ? left : right).push({ item, index }));
    return { left, right };
  }, [filtered]);

  const renderColumn = (column: { item: WardrobeItem; index: number }[]) =>
    column.map(({ item, index }) => (
      <ItemTile
        key={item.id}
        item={item}
        index={index}
        ratio={RATIOS[index % RATIOS.length]}
        onPress={() => setActiveItem(item)}
        onLongPress={() => setPendingRemoval(item)}
      />
    ));

  return (
    <Screen
      stickyHeaderIndices={[1]}
      overlay={
        <>
          <ItemSheet item={activeItem} onClose={() => setActiveItem(null)} />

          {pendingRemoval ? (
            <View style={styles.confirmCard}>
              <Text style={type.h4}>Remove {pendingRemoval.name}?</Text>
              <Text style={[type.small, styles.confirmBody]}>
                This takes it out of your wardrobe and styling pool.
              </Text>
              <View style={styles.confirmActions}>
                <Pressable onPress={() => setPendingRemoval(null)} style={styles.keepButton}>
                  <Text style={type.caps}>Keep</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    removeItem(pendingRemoval.id);
                    setPendingRemoval(null);
                  }}
                  style={styles.removeButton}
                >
                  <Text style={[type.caps, styles.removeLabel]}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </>
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={[type.eyebrow, styles.ash]}>{items.length} pieces</Text>
          <Text style={[type.h1, styles.title]}>Wardrobe</Text>
        </View>
        <Pressable
          onPress={() => router.push("/add-item")}
          accessibilityRole="button"
          accessibilityLabel="Add a piece"
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={20} color={colors.paper} />
        </Pressable>
      </View>

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Chip label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
          {CATEGORIES.map((category) => (
            <Chip
              key={category}
              label={category}
              selected={filter === category}
              onPress={() => setFilter(category)}
            />
          ))}
        </ScrollView>
        <View style={styles.filterRule} />
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          style={styles.empty}
          image={EMPTY_IMAGE}
          title={filter === "all" ? "An empty rail" : `No ${filter} yet`}
          message={
            filter === "all"
              ? "Add your first piece and the styling starts working from your own closet."
              : "Nothing catalogued in this category yet. Add a piece to fill the gap."
          }
          actionLabel="Add a piece"
          onAction={() => router.push("/add-item")}
        />
      ) : (
        <View style={styles.grid}>
          <View style={styles.column}>{renderColumn(columns.left)}</View>
          <View style={styles.column}>{renderColumn(columns.right)}</View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ash: { color: colors.ash },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: gutter,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  title: { marginTop: 10 },
  addButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink },
  pressed: { opacity: 0.85 },

  filterBar: { backgroundColor: paperAlpha.a95 },
  filterRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: gutter, paddingVertical: spacing.md },
  filterRule: { height: 1, backgroundColor: inkAlpha.a8 },

  empty: { marginTop: spacing.xl },
  grid: { flexDirection: "row", gap: spacing.lg, paddingHorizontal: gutter, paddingTop: spacing.xl },
  column: { flex: 1 },

  confirmCard: {
    position: "absolute",
    left: gutter,
    right: gutter,
    bottom: spacing.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: inkAlpha.a12,
    padding: spacing.xl,
    ...shadow.lift,
  },
  confirmBody: { marginTop: 6 },
  confirmActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  keepButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: inkAlpha.a20,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  removeButton: { flex: 1, backgroundColor: colors.ember, paddingVertical: spacing.md, alignItems: "center" },
  removeLabel: { color: colors.paper },
});
