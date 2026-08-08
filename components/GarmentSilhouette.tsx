import Svg, { Path } from "react-native-svg";
import { colors } from "@/constants/theme";
import { Category } from "@/data/mockWardrobe";

interface GarmentSilhouetteProps {
  category: Category;
  color: string;
  size?: number;
}

// Flat, single-path silhouettes per category. This is the app's signature look
// in place of real photography — see README "Design notes".
const paths: Record<Category, string> = {
  tops: "M32 8 L44 8 L52 18 L45 24 L41 20 L41 56 L23 56 L23 20 L19 24 L12 18 L20 8 Z",
  bottoms: "M20 8 L44 8 L46 56 L34 56 L32 30 L30 56 L18 56 Z",
  outerwear: "M30 6 L34 6 L46 12 L54 22 L47 28 L42 24 L42 58 L22 58 L22 24 L17 28 L10 22 L18 12 Z",
  shoes: "M10 40 C10 32 16 26 24 26 L34 26 C40 26 44 30 50 34 C54 36 56 38 56 42 C56 46 52 48 46 48 L14 48 C11 48 10 44 10 40 Z",
  accessories: "M32 10 C42 10 50 18 50 28 C50 38 42 46 32 46 C22 46 14 38 14 28 C14 18 22 10 32 10 Z M32 20 C27 20 24 24 24 28 C24 32 27 36 32 36 C37 36 40 32 40 28 C40 24 37 20 32 20 Z",
};

export function GarmentSilhouette({ category, color, size = 64 }: GarmentSilhouetteProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d={paths[category]} fill={color} stroke={colors.border} strokeWidth={1} />
    </Svg>
  );
}
