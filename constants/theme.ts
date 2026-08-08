// The ONLY place in the app that should contain hex colours.
// Editorial "Atelier" palette: warm paper and sand grounds, near-black ink,
// and muted accents used sparingly. Nothing is rounded — the look leans on
// hairlines, generous whitespace, and a Didone display face instead.

export const colors = {
  paper: "#F3F0EA",
  sand: "#E9E3D9",
  card: "#FFFFFF",
  ink: "#15120E",
  inkPressed: "#241F19",
  smoke: "#6C6459",
  ash: "#A69C90",
  line: "#E2DBD0",
  ember: "#9E4B2C",
  sage: "#78876E",
  gold: "#A8863F",
  plum: "#5B2B45",
  forest: "#2E6B4F",
};

// Ink at fixed opacities. RN has no colour-mix, so the alphas the web build
// wrote as `ink/10` live here as literal rgba strings.
export const inkAlpha = {
  a8: "rgba(21, 18, 14, 0.08)",
  a10: "rgba(21, 18, 14, 0.10)",
  a12: "rgba(21, 18, 14, 0.12)",
  a15: "rgba(21, 18, 14, 0.15)",
  a20: "rgba(21, 18, 14, 0.20)",
  a25: "rgba(21, 18, 14, 0.25)",
  a35: "rgba(21, 18, 14, 0.35)",
  a40: "rgba(21, 18, 14, 0.40)",
  a70: "rgba(21, 18, 14, 0.70)",
};

export const paperAlpha = {
  a50: "rgba(243, 240, 234, 0.50)",
  a60: "rgba(243, 240, 234, 0.60)",
  a85: "rgba(243, 240, 234, 0.85)",
  a92: "rgba(243, 240, 234, 0.92)",
  a95: "rgba(243, 240, 234, 0.95)",
};

// Gradient stop pairs for expo-linear-gradient. Both are the same trick: fade
// a photograph into the paper ground so the type below it sits on nothing.
export const gradients = {
  paperFade: ["rgba(243, 240, 234, 0)", colors.paper] as const,
  thumbShade: ["rgba(21, 18, 14, 0)", "rgba(21, 18, 14, 0.25)"] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// The gutter every screen's content is inset by. 24pt, matching the web's px-6.
export const gutter = spacing.xl;

// One device pixel wherever the design calls for a rule rather than a border.
export const hairline = 1;

// Deliberately square. Kept as a token so the intent is explicit rather than
// looking like an oversight at each call site.
export const radii = {
  none: 0,
};

// A single soft lift, used only where a surface genuinely floats (the sheet,
// the avatar, the wardrobe confirm card).
export const shadow = {
  lift: {
    shadowColor: "#15120E",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  sheet: {
    shadowColor: "#15120E",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 16,
  },
};

export const fonts = {
  display: "BodoniModa_400Regular",
  displayMedium: "BodoniModa_500Medium",
  displayItalic: "BodoniModa_400Regular_Italic",
  light: "Jost_300Light",
  regular: "Jost_400Regular",
  medium: "Jost_500Medium",
  semibold: "Jost_600SemiBold",
};

// Display sizes are set tight (leading below 1.0 at the large end) the way the
// web build did — a Didone at 42pt needs the line box pulled in to read as a
// masthead rather than body copy.
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 42, lineHeight: 41, letterSpacing: -0.4, color: colors.ink },
  heroItalic: { fontFamily: fonts.displayItalic, fontSize: 42, lineHeight: 41, letterSpacing: -0.4, color: colors.ink },
  h1: { fontFamily: fonts.display, fontSize: 40, lineHeight: 40, color: colors.ink },
  h2: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.ink },
  h3: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: colors.ink },
  h4: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24, color: colors.ink },
  h5: { fontFamily: fonts.display, fontSize: 15, lineHeight: 19, color: colors.ink },
  numeral: { fontFamily: fonts.display, fontSize: 34, lineHeight: 34, color: colors.ink },
  body: { fontFamily: fonts.light, fontSize: 13, lineHeight: 20, color: colors.smoke },
  bodyInk: { fontFamily: fonts.light, fontSize: 13, lineHeight: 20, color: colors.ink },
  small: { fontFamily: fonts.light, fontSize: 11.5, lineHeight: 17, color: colors.smoke },
  label: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 18, color: colors.ink },
  // The uppercase micro-type that carries most of the interface: section
  // titles, chips, buttons, tab labels.
  eyebrow: {
    fontFamily: fonts.medium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 2.2,
    textTransform: "uppercase" as const,
    color: colors.ink,
  },
  caps: {
    fontFamily: fonts.medium,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.8,
    textTransform: "uppercase" as const,
    color: colors.ink,
  },
  capsButton: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2.2,
    textTransform: "uppercase" as const,
    color: colors.ink,
  },
  tab: {
    fontFamily: fonts.medium,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase" as const,
  },
  footnote: { fontFamily: fonts.displayItalic, fontSize: 11, lineHeight: 16, color: colors.ash },
};

// Shared easing for every transition in the app. Matches the web build's
// cubic-bezier(0.22, 1, 0.36, 1) — a quick departure with a long settle.
export const easeOutExpo = { x1: 0.22, y1: 1, x2: 0.36, y2: 1 };
