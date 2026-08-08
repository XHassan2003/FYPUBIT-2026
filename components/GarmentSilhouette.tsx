import Svg, { Path } from "react-native-svg";
import { Category } from "@/data/mockWardrobe";

interface GarmentSilhouetteProps {
  category: Category;
  color: string;
  size?: number;
}

// Flat, single-path silhouettes per category — the fallback whenever a piece
// has no photograph. Drawn on a 64×64 grid so they optically align with each
// other at any size.
const paths: Record<Category, string> = {
  tops: "M24 8 L16 12 L6 18 L11 28 L17 25 L17 56 L47 56 L47 25 L53 28 L58 18 L48 12 L40 8 C38 14 26 14 24 8 Z",
  bottoms: "M18 8 L46 8 L48 24 L45 58 L35 58 L32 30 L29 58 L19 58 L16 24 Z",
  outerwear:
    "M24 8 L14 13 L6 19 L11 30 L16 27 L16 57 L32 57 L32 14 L32 57 L48 57 L48 27 L53 30 L58 19 L50 13 L40 8 L32 18 Z",
  shoes: "M10 26 L22 26 L27 34 C31 40 42 41 51 43 C56 44 58 47 58 50 L58 54 L10 54 Z",
  accessories:
    "M32 10 C22 10 22 22 22 26 L16 26 L14 56 L50 56 L48 26 L42 26 C42 22 42 10 32 10 Z M27 26 C27 20 28 15 32 15 C36 15 37 20 37 26 Z",
};

export function GarmentSilhouette({ category, color, size = 64 }: GarmentSilhouetteProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path
        d={paths[category]}
        fill={color}
        stroke="rgba(21, 18, 14, 0.18)"
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
