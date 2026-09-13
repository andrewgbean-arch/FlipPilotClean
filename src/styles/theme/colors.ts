export const BaseColors = {
  background: "#0A1128",
  text: "#FFFFFF",
  accent: "#208AEF",
  card: "#111827",

  white: "#FFFFFF",
  muted: "#7A8BAA",
};

export const ProColors = {
  background: "#000000",
  text: "#FFFFFF",
  gold: "#FFD700",
  goldDeep: "#C9A300",
  goldSoftGlow: "rgba(255, 215, 0, 0.35)",
  card: "#050505",

  white: "#FFFFFF",
  muted: "#7A8BAA",
};

/* ================================
   ⭐ ADD LIGHT + DARK VARIANTS
================================ */
export const Colors = {
  // Your existing fields
  background: BaseColors.background,
  primary: BaseColors.background,
  accent: BaseColors.accent,
  text: BaseColors.text,
  card: BaseColors.card,

  white: BaseColors.white,
  muted: BaseColors.muted,

  // ⭐ FIX: Add missing theme variants
  light: {
    text: "#000000",
    background: "#ffffff",
    backgroundElement: "#F0F0F3",
    backgroundSelected: "#E0E1E6",
    textSecondary: "#60646C",
    icon: "#000000",   // ⭐ REQUIRED
  },

  dark: {
    text: "#ffffff",
    background: "#000000",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    textSecondary: "#B0B4BA",
    icon: "#ffffff",   // ⭐ REQUIRED
  },
};
