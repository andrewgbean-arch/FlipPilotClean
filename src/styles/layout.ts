// src/styles/layout.ts

export const layout = {
  // ⭐ Spacing scale — consistent across all screens
  spacing: {
    xs: 4,
    sm: 8,
    md: 14,
    lg: 22,
    xl: 32,
    full: 40, // used for big hero sections
  },

  // ⭐ Radius scale — matches Dealer Mode + Supernova cards
  radius: {
    xs: 4,
    sm: 8,
    md: 14,
    lg: 20,
    xl: 26,
    full: 999,
  },

  // ⭐ Shadow presets — tuned for dark UI + neon accents
  shadow: {
    sm: {
      elevation: 2,
      shadowColor: "rgba(0,0,0,0.35)",
      shadowOpacity: 0.25,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
    },
    md: {
      elevation: 4,
      shadowColor: "rgba(0,0,0,0.45)",
      shadowOpacity: 0.35,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    lg: {
      elevation: 8,
      shadowColor: "rgba(0,0,0,0.55)",
      shadowOpacity: 0.45,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    glow: {
      shadowColor: "rgba(255,215,0,0.45)",
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 0 },
    },
  },

  // ⭐ Screen layout presets — consistent padding + radius
  screen: {
    padding: 22,
    radius: 18,
    headerSpacing: 14,
    sectionSpacing: 24,
  },

  // ⭐ Button layout presets — consistent across app
  button: {
    padding: 16,
    radius: 14,
    spacing: 12,
  },

  // ⭐ FAB preset — used by DealerFab
  fab: {
    size: 56,
    padding: 14,
    radius: 999,
    offset: {
      bottom: 24,
      right: 24,
    },
  },
};
