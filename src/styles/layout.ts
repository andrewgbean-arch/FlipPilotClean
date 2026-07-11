// src/styles/layout.ts

export const layout = {
  radius: {
    xs: 6,
    sm: 8,
    md: 14,
    lg: 20,
    xl: 28,
    full: 999,
  },

  spacing: {
    xxs: 4,
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  shadow: {
    soft: {
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 3,
    },
    medium: {
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 5,
    },
    strong: {
      shadowColor: "#000",
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 8,
    },
    goldGlow: {
      shadowColor: "#FFD700",
      shadowOpacity: 0.45,
      shadowRadius: 18,
      elevation: 6,
    },
  },

  // ⭐ FIXED — padding added
  screen: {
    padding: 20,        // <— REQUIRED for VehicleDetails
    horizontal: 20,
    vertical: 16,
  },

  button: {
    height: 52,
    radius: 50,
    paddingHorizontal: 24,
  },
};
