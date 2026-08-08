// The ONLY place in the app that should contain hex colours.
// Palette is inspired by Style DNA's purple-to-coral identity: lavender
// surfaces, a deep violet primary, and a coral/pink accent for highlights.

export const colors = {
  paper: "#F5F2FB",
  paperDim: "#EAE3F7",
  ink: "#181321",
  inkMuted: "#6B6478",
  inkFaint: "#A79FB8",
  card: "#FFFFFF",
  onGradient: "#FFFFFF",
  border: "#E6DEF3",
  violet: "#6C4BD1",
  violetDeep: "#4A2F9E",
  violetMuted: "#EDE6FB",
  coral: "#FF5C7A",
  coralDeep: "#E23F60",
  coralMuted: "#FFE3E9",
  sage: "#8A9A80",
  sageMuted: "#EAEEE6",
  gold: "#B98B3E",
  danger: "#C22B45",
  success: "#3D9A6B",
  successMuted: "#E1F4EA",
};

// Gradient stop pairs, used with expo-linear-gradient. hero* mirrors the
// coral/orange glow banner; feature* mirrors the lavender promo cards.
export const gradients = {
  hero: ["#B983FF", "#FF6F91"] as const,
  feature: ["#D9C6FF", "#B995F5"] as const,
  primaryButton: ["#7B4FE0", "#5C34C4"] as const,
  avatarRing: ["#B983FF", "#FF6F91"] as const,
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

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  pill: 999,
};

// Shared elevation styles so cards read as lifted, tappable surfaces instead
// of flat rectangles.
export const shadow = {
  sm: {
    shadowColor: "#150F24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: "#150F24",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
};

export const type = {
  display: { fontFamily: "Inter_700Bold", fontSize: 30, lineHeight: 36, color: colors.ink },
  displayAccent: { fontFamily: "Fraunces_600SemiBold_Italic", fontSize: 30, lineHeight: 36, color: colors.violetDeep },
  h1: { fontFamily: "Fraunces_600SemiBold", fontSize: 30, lineHeight: 36, color: colors.ink },
  h2: { fontFamily: "Fraunces_600SemiBold", fontSize: 22, lineHeight: 28, color: colors.ink },
  h3: { fontFamily: "Fraunces_600SemiBold", fontSize: 18, lineHeight: 24, color: colors.ink },
  body: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 21, color: colors.ink },
  bodyMedium: { fontFamily: "Inter_500Medium", fontSize: 15, lineHeight: 21, color: colors.ink },
  small: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  smallMedium: { fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  eyebrow: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    color: colors.violetDeep,
    textTransform: "uppercase" as const,
  },
};
