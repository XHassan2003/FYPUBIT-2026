export type Category = "tops" | "bottoms" | "outerwear" | "shoes" | "accessories";
export type Occasion = "work" | "casual" | "date night" | "workout" | "formal";

export interface WardrobeItem {
  id: string;
  name: string;
  brand?: string;
  category: Category;
  color: string; // hex, drives the silhouette fill + swatch dot
  colorName: string;
  occasions: Occasion[];
  image?: string;
  favorite?: boolean;
}

export const CATEGORIES: Category[] = ["tops", "bottoms", "outerwear", "shoes", "accessories"];
export const OCCASIONS: Occasion[] = ["work", "casual", "date night", "workout", "formal"];

// Unsplash CDN photos (Unsplash License: free for commercial use, no
// attribution required). Fictional brand names, not real-world labels — see
// README "Known gaps": these are placeholder catalog photos, not a real
// retailer feed.
function photo(id: string) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;
}

export const mockWardrobe: WardrobeItem[] = [
  { id: "top-1", name: "Oxford Shirt", brand: "Hartley Row", category: "tops", color: "#FFFFFF", colorName: "white", occasions: ["work", "formal", "casual"], image: photo("1620799139507-2a76f79a2f4d") },
  { id: "top-2", name: "Crewneck Tee", brand: "Everline", category: "tops", color: "#1C1B19", colorName: "black", occasions: ["casual", "workout"], image: photo("1581655353564-df123a1eb820") },
  { id: "top-3", name: "Knit Sweater", brand: "Aster & Oak", category: "tops", color: "#8A9A80", colorName: "sage", occasions: ["casual", "work"], image: photo("1574201635302-388dd92a4c3f") },
  { id: "top-4", name: "Silk Blouse", brand: "Maison Vale", category: "tops", color: "#F1E9DA", colorName: "cream", occasions: ["work", "date night", "formal"], image: photo("1761117228880-df2425bd70da") },
  { id: "top-5", name: "Striped Cotton Tee", brand: "Everline", category: "tops", color: "#D8D2C4", colorName: "stone", occasions: ["casual", "workout"], image: photo("1618786177957-29d9b6b26d8a") },

  { id: "bottom-1", name: "Denim Jeans", brand: "Form & Fold", category: "bottoms", color: "#3B4A6B", colorName: "indigo", occasions: ["casual"], image: photo("1570308345368-f21d4b0d81a9") },
  { id: "bottom-2", name: "Tailored Trousers", brand: "Hartley Row", category: "bottoms", color: "#3A3A3A", colorName: "charcoal", occasions: ["work", "formal"], image: photo("1624378439575-d8705ad7ae80") },
  { id: "bottom-3", name: "Cargo Pants", brand: "North & Ash", category: "bottoms", color: "#6B6E4E", colorName: "olive", occasions: ["casual", "workout"], image: photo("1594633312681-425c7b97ccd1") },
  { id: "bottom-4", name: "Pencil Skirt", brand: "Maison Vale", category: "bottoms", color: "#1C1B19", colorName: "black", occasions: ["work", "date night", "formal"], image: photo("1763444134734-166e349dcba8") },

  { id: "outer-1", name: "Wool Coat", brand: "COAST No.5", category: "outerwear", color: "#B08968", colorName: "camel", occasions: ["work", "formal", "date night"], image: photo("1611246539484-1f8e71d19ea5") },
  { id: "outer-2", name: "Denim Jacket", brand: "Form & Fold", category: "outerwear", color: "#4A5A78", colorName: "denim", occasions: ["casual"], image: photo("1611312449408-fcece27cdbb7") },
  { id: "outer-3", name: "Tailored Blazer", brand: "Hartley Row", category: "outerwear", color: "#1C1B19", colorName: "black", occasions: ["work", "formal", "date night"], image: photo("1616065297556-f05bc00c9a3e") },

  { id: "shoe-1", name: "Leather Sneakers", brand: "Birch Supply Co.", category: "shoes", color: "#FFFFFF", colorName: "white", occasions: ["casual", "workout"], image: photo("1676379827610-c380c52db0c6") },
  { id: "shoe-2", name: "Leather Loafers", brand: "Wolfe & Sons", category: "shoes", color: "#2B2420", colorName: "black", occasions: ["work", "formal", "date night"], image: photo("1616406432452-07bc5938759d") },
  { id: "shoe-3", name: "Ankle Boots", brand: "Wolfe & Sons", category: "shoes", color: "#A9784F", colorName: "tan", occasions: ["casual", "date night"], image: photo("1605733160314-4fc7dac4bb16") },
  { id: "shoe-4", name: "Running Shoes", brand: "Birch Supply Co.", category: "shoes", color: "#6E6A62", colorName: "grey", occasions: ["workout"], image: photo("1542291026-7eec264c27ff") },

  { id: "acc-1", name: "Gold Hoop Earrings", brand: "Rowan Studio", category: "accessories", color: "#B98B3E", colorName: "gold", occasions: ["date night", "formal"], image: photo("1600721391776-b5cd0e0048f9") },
  { id: "acc-2", name: "Leather Belt", brand: "Wolfe & Sons", category: "accessories", color: "#6B4A32", colorName: "brown", occasions: ["work", "casual"], image: photo("1664286074176-5206ee5dc878") },
  { id: "acc-3", name: "Silk Scarf", brand: "Maison Vale", category: "accessories", color: "#6B2545", colorName: "plum", occasions: ["work", "date night"], image: photo("1606259458027-54d2a728b6ab") },
  { id: "acc-4", name: "Canvas Tote Bag", brand: "North & Ash", category: "accessories", color: "#D8D2C4", colorName: "stone", occasions: ["casual", "work"], image: photo("1574365569389-a10d488ca3fb") },
];

// Placeholder colour-pairing rules, not a model. suggestOutfit() leans on this
// until the real recommender plugs in — see README "Where the real AI plugs in".
export const colorPairings: Record<string, string[]> = {
  white: ["indigo", "charcoal", "black", "camel", "tan", "olive"],
  black: ["white", "cream", "camel", "stone", "gold", "grey"],
  sage: ["cream", "stone", "black", "tan", "white"],
  cream: ["black", "camel", "plum", "indigo", "brown"],
  stone: ["black", "denim", "sage", "brown", "white"],
  indigo: ["white", "cream", "tan", "camel"],
  charcoal: ["white", "cream", "gold", "black"],
  olive: ["white", "stone", "tan", "brown"],
  camel: ["white", "black", "denim", "cream"],
  denim: ["white", "stone", "tan", "camel"],
  tan: ["indigo", "white", "olive", "denim"],
  gold: ["black", "charcoal", "plum"],
  brown: ["cream", "olive", "stone"],
  plum: ["cream", "black", "gold"],
  grey: ["black", "white", "sage"],
};
