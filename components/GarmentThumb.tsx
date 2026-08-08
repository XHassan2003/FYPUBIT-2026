import { Image } from "expo-image";
import { StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "@/constants/theme";
import { WardrobeItem } from "@/data/mockWardrobe";
import { GarmentSilhouette } from "./GarmentSilhouette";

interface GarmentThumbProps {
  item: Pick<WardrobeItem, "category" | "color" | "image" | "name">;
  /** Callers own the frame's dimensions — pass width/height, flex, or aspectRatio. */
  style?: ViewStyle | ViewStyle[];
  silhouetteSize?: number;
}

export function GarmentThumb({ item, style, silhouetteSize = 56 }: GarmentThumbProps) {
  return (
    <View style={[styles.frame, style]}>
      {item.image ? (
        <Image
          source={{ uri: item.image }}
          style={styles.image}
          contentFit="cover"
          transition={400}
          accessibilityLabel={item.name}
        />
      ) : (
        <View style={styles.silhouetteWrap}>
          <GarmentSilhouette category={item.category} color={item.color} size={silhouetteSize} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.sand,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  // A hair lighter than sand, so a silhouette tile reads as deliberate rather
  // than as a photo that failed to load.
  silhouetteWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#EFEAE1" },
});
