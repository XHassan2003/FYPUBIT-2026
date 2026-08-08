import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { colors, radii } from "@/constants/theme";
import { WardrobeItem } from "@/data/mockWardrobe";
import { GarmentSilhouette } from "./GarmentSilhouette";

interface GarmentThumbProps {
  item: Pick<WardrobeItem, "category" | "color" | "image">;
  size?: number;
  rounded?: boolean;
}

export function GarmentThumb({ item, size = 64, rounded = true }: GarmentThumbProps) {
  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: rounded ? radii.md : 0 }]}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" transition={150} />
      ) : (
        <View style={styles.silhouetteWrap}>
          <GarmentSilhouette category={item.category} color={item.color} size={size * 0.7} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.paperDim,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  silhouetteWrap: { alignItems: "center", justifyContent: "center" },
});
