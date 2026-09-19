// src/styles/theme.ts

import { layout } from "./layout";
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
  warning: string;
  // Borders on cards and rows: a faint line instead of a bright outline.
  hairline: string;
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

  radius: typeof layout.radius;
  spacing: typeof layout.spacing;

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

/* ================================
   ⭐ BASE THEME (shared)
================================ */
const baseTheme = {
  radius: layout.radius,
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
      backgroundColor: "#0F162E",
      borderRadius: layout.radius.xl,
      borderWidth: 1,
      borderColor: "rgba(212,175,55,0.45)",
      padding: layout.spacing.lg,
    },

    dealer: {
      backgroundColor: "#1F2937",
      borderRadius: layout.radius.md,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      padding: layout.spacing.md,
    },
  },
};

/* ================================
   ⭐ FREE THEME (Supernova-ready)
================================ */
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
  warning: "#FFB547",
  hairline: "rgba(255, 255, 255, 0.08)",
  muted: "#9CA3AF",
  secondary: "#3C87F7",

  white: "#FFFFFF",
  black: "#000000",

  textStyle: {
    fontWeight: 500,
    fontSize: 16,
    color: "#FFFFFF",
  },

  toggleTheme: () => {},

  radius: baseTheme.radius,
  spacing: baseTheme.spacing,
  shadow: baseTheme.shadow,
  screen: baseTheme.screen,
  button: baseTheme.button,

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
      borderRadius: layout.radius.md,
      padding: layout.spacing.md,
    },
  },
};

/* ================================
   ⭐ PRO THEME (Supernova-ready)
================================ */
export const proTheme: Theme = {
  mode: "pro",

  background: "#050A1A",
  text: "#F8F8F8",
  card: "#0F162E",
  cardElevated: "#1F2937",

  accent: "#FFD700",
  gold: "#FFD700",
  goldDeep: "#C5A100",
  goldSoftGlow: "rgba(255, 215, 0, 0.45)",
  goldHardGlow: "rgba(255, 215, 0, 0.75)",

  success: "#4CAF50",
  danger: "#FF4D4D",
  warning: "#FFB547",
  hairline: "rgba(255, 255, 255, 0.08)",
  muted: "#A0A0A0",
  secondary: "#4FA3FF",

  white: "#FFFFFF",
  black: "#000000",

  textStyle: {
    fontWeight: 500,
    fontSize: 16,
    color: "#F8F8F8",
  },

  toggleTheme: () => {},

  radius: baseTheme.radius,
  spacing: baseTheme.spacing,
  shadow: baseTheme.shadow,
  screen: baseTheme.screen,
  button: baseTheme.button,

  heroGradient: {
    start: "rgba(212, 175, 55, 0.20)",
    middle: "rgba(5, 10, 26, 0.85)",
    end: "rgba(5, 10, 26, 1)",
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
      backgroundColor: "#0F162E",
      borderColor: "rgba(212,175,55,0.55)",
      padding: layout.spacing.lg,
    },
    dealer: baseTheme.cardStyles.dealer,
  },
};

export const themes = {
  free: freeTheme,
  pro: proTheme,
};
