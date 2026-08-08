import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, shadow, spacing, type } from "@/constants/theme";
import { WardrobeItem } from "@/data/mockWardrobe";
import { useWardrobe } from "@/store/useWardrobe";
import { GarmentSilhouette } from "./GarmentSilhouette";

interface ItemTileProps {
  item: WardrobeItem;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
}

export function ItemTile({ item, onPress, onLongPress, selected }: ItemTileProps) {
  const toggleFavorite = useWardrobe((state) => state.toggleFavorite);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.tile, selected && styles.tileSelected, pressed && styles.pressed]}
    >
      <View style={styles.thumb}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" transition={150} />
        ) : (
          <View style={styles.silhouetteWrap}>
            <GarmentSilhouette category={item.category} color={item.color} size={48} />
          </View>
        )}

        <Pressable
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation();
            toggleFavorite(item.id);
          }}
          style={styles.favorite}
        >
          <Ionicons name={item.favorite ? "heart" : "heart-outline"} size={16} color={item.favorite ? colors.coral : colors.card} />
        </Pressable>
      </View>

      <View style={styles.info}>
        {item.brand ? (
          <Text style={type.eyebrow} numberOfLines={1}>
            {item.brand}
          </Text>
        ) : null}
        <Text style={type.smallMedium} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.colorRow}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={type.small} numberOfLines={1}>
            {item.colorName}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    overflow: "hidden",
    ...shadow.sm,
  },
  tileSelected: {
    borderWidth: 2,
    borderColor: colors.violet,
  },
  pressed: { opacity: 0.9 },
  thumb: {
    width: "100%",
    aspectRatio: 0.85,
    backgroundColor: colors.paperDim,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  silhouetteWrap: { alignItems: "center", justifyContent: "center" },
  favorite: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: "rgba(24, 19, 33, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: { padding: spacing.md, gap: 2 },
  colorRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border },
});
