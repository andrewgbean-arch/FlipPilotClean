// src/styles/theme.ts

import { layout } from "../styles/layout";
import type { TextStyle } from "react-native";

export interface Theme {
  mode: "free" | "pro";

  background: string;
  text: string;
  card: string;
  cardElevated: string;

  accent: string;
  gold: string;
  goldDeep: string;
  goldSoftGlow: string;
  goldHardGlow: string;

  success: string;
  danger: string;
  muted: string;
  secondary: string;

  white: string;
  black: string;

  textStyle: {
    fontWeight?: TextStyle["fontWeight"];
    fontSize?: number;
    color?: string;
  };

  toggleTheme: () => void;

  radius: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };

  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    full: number;
  };

  shadow: typeof layout.shadow;
  screen: typeof layout.screen;
  button: typeof layout.button;

  heroGradient: {
    start: string;
    middle: string;
    end: string;
  };

  animation: {
    fast: number;
    normal: number;
    slow: number;

    pulse: {
      small: number;
      medium: number;
      large: number;
    };

    sparkle: {
      duration: number;
      intensity: number;
    };
  };

  cardStyles: {
    supernova: {
      backgroundColor: string;
      borderRadius: number;
      borderWidth: number;
      borderColor: string;
      padding: number;
    };
    dealer: {
      backgroundColor: string;
      borderRadius: number;
      borderWidth: number;
      borderColor: string;
      padding: number;
    };
  };
}

const baseTheme = {
  radius: {
    ...layout.radius,
    xl: 22,
  },
  spacing: layout.spacing,
  shadow: layout.shadow,
  screen: layout.screen,
  button: layout.button,
  animation: {
    fast: 120,
    normal: 220,
    slow: 350,
    pulse: {
      small: 0.95,
      medium: 0.9,
      large: 0.85,
    },
    sparkle: {
      duration: 900,
      intensity: 0.65,
    },
  },
  cardStyles: {
    supernova: {
      backgroundColor: "#111827",
      borderRadius: 22,
      borderWidth: 1,
      borderColor: "rgba(212,175,55,0.45)",
      padding: 20,
    },
    dealer: {
      backgroundColor: "#1F2937",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.10)",
      padding: 18,
    },
  },
};

export const freeTheme: Theme = {
  mode: "free",

  background: "#0A1128",
  text: "#FFFFFF",
  card: "#111A3A",
  cardElevated: "#1F2937",

  accent: "#FFD700",
  gold: "#FFD700",
  goldDeep: "#C5A100",
  goldSoftGlow: "rgba(255, 215, 0, 0.35)",
  goldHardGlow: "rgba(255, 215, 0, 0.75)",

  success: "#4CAF50",
  danger: "#FF4D4D",
  muted: "#9CA3AF",
  secondary: "#3C87F7",

  white: "#FFFFFF",
  black: "#000000",

  textStyle: {
    fontWeight: "500",
    fontSize: 16,
    color: "#FFFFFF",
  },

  toggleTheme: () => {},

  heroGradient: {
    start: "rgba(212, 175, 55, 0.15)",
    middle: "rgba(10, 17, 40, 0.85)",
    end: "rgba(10, 17, 40, 1)",
  },

  animation: {
    ...baseTheme.animation,
    sparkle: {
      ...baseTheme.animation.sparkle,
      intensity: 0.6,
    },
  },

  cardStyles: {
    supernova: baseTheme.cardStyles.supernova,
    dealer: {
      ...baseTheme.cardStyles.dealer,
      borderRadius: 14,
      padding: 16,
      borderColor: "rgba(255,255,255,0.08)",
    },
  },

  radius: baseTheme.radius,
  spacing: baseTheme.spacing,
  shadow: baseTheme.shadow,
  screen: baseTheme.screen,
  button: baseTheme.button,
};

export const proTheme: Theme = {
  mode: "pro",

  // ⭐ FlipPilot Pro Neon Theme
  background: "#0A0F1F",
  text: "#FFFFFF",
  card: "#11182C",
  cardElevated: "#1F2937",

  accent: "#3A7BFF", // neon blue
  gold: "#FFD700",
  goldDeep: "#E6B800",
  goldSoftGlow: "rgba(255, 215, 0, 0.45)",
  goldHardGlow: "rgba(255, 215, 0, 0.75)",

  success: "#4CAF50",
  danger: "#FF4D4D",
  muted: "#6C7A99",
  secondary: "#A3B3D9",

  white: "#FFFFFF",
  black: "#000000",

  textStyle: {
    fontWeight: "600",
    fontSize: 17,
    color: "#FFFFFF",
  },

  toggleTheme: () => {},

  heroGradient: {
    start: "#3A7BFF",
    middle: "#4D9EFF",
    end: "#FF66CC",
  },

  animation: {
    ...baseTheme.animation,
    sparkle: {
      ...baseTheme.animation.sparkle,
      intensity: 0.7,
    },
  },

  cardStyles: {
    supernova: {
      ...baseTheme.cardStyles.supernova,
      backgroundColor: "#11182C",
      borderColor: "rgba(58, 123, 255, 0.45)", // neon blue glow
      padding: 24,
    },
    dealer: {
      ...baseTheme.cardStyles.dealer,
    },
  },

  radius: baseTheme.radius,
  spacing: baseTheme.spacing,
  shadow: baseTheme.shadow,
  screen: baseTheme.screen,
  button: baseTheme.button,
};

export const themes = {
  free: freeTheme,
  pro: proTheme,
};
