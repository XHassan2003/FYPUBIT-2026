import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { colors, gradients, inkAlpha, paperAlpha, spacing, type } from "@/constants/theme";
import { WardrobeItem } from "@/data/mockWardrobe";
import { useWardrobe } from "@/store/useWardrobe";
import { GarmentThumb } from "./GarmentThumb";

interface ItemTileProps {
  item: WardrobeItem;
  /** Position in the grid — staggers the entrance so the column fills in. */
  index?: number;
  /** width ÷ height. The wardrobe varies this per tile to break the grid up. */
  ratio?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
}

export function ItemTile({ item, index = 0, ratio = 0.75, onPress, onLongPress, selected }: ItemTileProps) {
  const toggleFavorite = useWardrobe((state) => state.toggleFavorite);

  return (
    <Animated.View
      entering={FadeInDown.duration(550).delay(Math.min(index, 8) * 45)}
      style={styles.tile}
    >
      <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={550}>
        {({ pressed }) => (
          <View style={pressed && styles.pressed}>
            <View style={[styles.frame, selected && styles.frameSelected]}>
              <GarmentThumb item={item} style={[styles.thumb, { aspectRatio: ratio }]} />
              <LinearGradient colors={gradients.thumbShade} style={styles.shade} pointerEvents="none" />
            </View>

            <View style={styles.info}>
              <Text style={[type.eyebrow, styles.brand]} numberOfLines={1}>
                {item.brand ?? item.category}
              </Text>
              <Text style={[type.h5, styles.name]} numberOfLines={2}>
                {item.name}
              </Text>
              <View style={styles.colorRow}>
                <View style={[styles.swatch, { backgroundColor: item.color }]} />
                <Text style={type.small} numberOfLines={1}>
                  {item.colorName}
                </Text>
              </View>
            </View>
          </View>
        )}
      </Pressable>

      <Pressable
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={item.favorite ? `Remove ${item.name} from favourites` : `Save ${item.name} to favourites`}
        onPress={() => toggleFavorite(item.id)}
        style={({ pressed }) => [styles.favorite, pressed && styles.favoritePressed]}
      >
        <Ionicons
          name={item.favorite ? "heart" : "heart-outline"}
          size={15}
          color={item.favorite ? colors.ember : inkAlpha.a70}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: { marginBottom: spacing.xl },
  pressed: { opacity: 0.9 },
  // The ring is always laid out and only changes colour, so selecting a tile
  // doesn't reflow the column. The 2pt padding is the web's ring-offset.
  frame: { borderWidth: 1, borderColor: "transparent", padding: 2 },
  frameSelected: { borderColor: colors.ink },
  thumb: { width: "100%" },
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 64 },
  info: { paddingTop: spacing.md },
  brand: { color: colors.ash },
  name: { marginTop: 6 },
  colorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 6 },
  swatch: { width: 9, height: 9, borderWidth: 1, borderColor: inkAlpha.a15 },
  favorite: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: paperAlpha.a85,
  },
  favoritePressed: { opacity: 0.75 },
});
