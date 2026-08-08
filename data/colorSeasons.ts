// Placeholder seasonal colour-analysis rules, not a model — same spirit as
// data/mockWardrobe.ts#colorPairings. The quiz result drives the "Color DNA"
// card in Profile and the match checker on wardrobe items.

export type SeasonId = "winter" | "spring" | "summer" | "autumn";

export interface ColorSeason {
  id: SeasonId;
  name: string;
  tagline: string;
  palette: string[];
  compatibleColorNames: string[];
}

export const COLOR_SEASONS: Record<SeasonId, ColorSeason> = {
  winter: {
    id: "winter",
    name: "True Winter",
    tagline: "Cool, high-contrast, and crisp",
    palette: ["#1C1B19", "#FFFFFF", "#3B4A6B", "#3A3A3A", "#6B2545", "#6E6A62"],
    compatibleColorNames: ["black", "white", "indigo", "charcoal", "plum", "grey"],
  },
  spring: {
    id: "spring",
    name: "Clear Spring",
    tagline: "Warm, bright, and clear",
    palette: ["#B98B3E", "#B08968", "#A9784F", "#F1E9DA", "#6B6E4E", "#FFFFFF"],
    compatibleColorNames: ["gold", "camel", "tan", "cream", "olive", "white"],
  },
  summer: {
    id: "summer",
    name: "Soft Summer",
    tagline: "Cool, soft, and blended",
    palette: ["#8A9A80", "#D8D2C4", "#6E6A62", "#4A5A78", "#FFFFFF", "#6B2545"],
    compatibleColorNames: ["sage", "stone", "grey", "denim", "white", "plum"],
  },
  autumn: {
    id: "autumn",
    name: "Warm Autumn",
    tagline: "Warm, rich, and earthy",
    palette: ["#B08968", "#6B6E4E", "#6B4A32", "#B98B3E", "#D8D2C4", "#A9784F"],
    compatibleColorNames: ["camel", "olive", "brown", "gold", "stone", "tan"],
  },
};

export interface QuizOption {
  label: string;
  scores: Partial<Record<SeasonId, number>>;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
}

export const COLOR_QUIZ: QuizQuestion[] = [
  {
    id: "undertone",
    question: "What's your skin's undertone?",
    options: [
      { label: "Cool — pink or blue undertones", scores: { winter: 2, summer: 2 } },
      { label: "Warm — golden or peachy undertones", scores: { spring: 2, autumn: 2 } },
      { label: "Neutral — a mix of both", scores: { summer: 1, autumn: 1 } },
    ],
  },
  {
    id: "eyes",
    question: "What best describes your eye colour?",
    options: [
      { label: "Deep brown or black", scores: { winter: 2, autumn: 1 } },
      { label: "Blue or grey", scores: { winter: 1, summer: 2 } },
      { label: "Green or hazel", scores: { spring: 1, autumn: 2 } },
      { label: "Warm brown or amber", scores: { spring: 2, autumn: 1 } },
    ],
  },
  {
    id: "hair",
    question: "What best describes your natural hair colour?",
    options: [
      { label: "Black or deep brunette", scores: { winter: 2 } },
      { label: "Ash brown or blonde", scores: { summer: 2 } },
      { label: "Golden blonde or strawberry", scores: { spring: 2 } },
      { label: "Auburn, copper, or warm brunette", scores: { autumn: 2 } },
    ],
  },
  {
    id: "contrast",
    question: "How do bold, high-contrast outfits look on you?",
    options: [
      { label: "Striking — I look best in bold contrast", scores: { winter: 2, spring: 1 } },
      { label: "Better softened — muted and blended suits me more", scores: { summer: 2, autumn: 1 } },
    ],
  },
];

export function computeSeason(selected: QuizOption[]): SeasonId {
  const totals: Record<SeasonId, number> = { winter: 0, spring: 0, summer: 0, autumn: 0 };
  for (const option of selected) {
    for (const [season, points] of Object.entries(option.scores) as [SeasonId, number][]) {
      totals[season] += points;
    }
  }
  return (Object.keys(totals) as SeasonId[]).reduce((best, season) => (totals[season] > totals[best] ? season : best), "winter");
}
