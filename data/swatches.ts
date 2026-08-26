// The colour vocabulary the wardrobe speaks.
//
// Lives here rather than inside the Add Piece screen because two things need
// it now: the form's picker, and the photo-analysis request, which sends the
// list to the service so Gemini's free-form hex can be snapped to one of these
// rather than the service holding its own copy. Same reasoning as the seasonal
// palettes in colorSeasons.ts — the app owns its vocabulary.

export interface Swatch {
  hex: string;
  name: string;
}

export const SWATCHES: Swatch[] = [
  { hex: "#FFFFFF", name: "white" },
  { hex: "#F1E9DA", name: "cream" },
  { hex: "#D8D2C4", name: "stone" },
  { hex: "#8A9A80", name: "sage" },
  { hex: "#6B6E4E", name: "olive" },
  { hex: "#B08968", name: "camel" },
  { hex: "#A9784F", name: "tan" },
  { hex: "#3B4A6B", name: "indigo" },
  { hex: "#3A3A3A", name: "charcoal" },
  { hex: "#1C1B19", name: "black" },
];
