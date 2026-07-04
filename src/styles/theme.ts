// src/styles/theme.ts

import { layout } from "./layout";

export interface Theme {
  background: string;
  text: string;
  card: string;

  accent: string;
  gold: string;
  goldDeep: string;
  goldSoftGlow: string;

  success: string;
  danger: string;
  muted: string;
  secondary: string;

  white: string;
  black: string;

  // Optional helpers
  radius: typeof layout.radius;
  spacing: typeof layout.spacing;
  shadow: typeof layout.shadow;
  screen: typeof layout.screen;
  button: typeof layout.button;
}

// ⭐ FREE THEME (default)
export const freeTheme: Theme = {
  background: "#0A1128",
  text: "#FFFFFF",
  card: "#111A3A",

  accent: "#FFD700",
  gold: "#FFD700",
  goldDeep: "#C5A100",
  goldSoftGlow: "rgba(255, 215, 0, 0.35)",

  success: "#4CAF50",
  danger: "#FF4D4D",
  muted: "#9CA3AF",
  secondary: "#3C87F7",

  white: "#FFFFFF",
  black: "#000000",

  radius: layout.radius,
  spacing: layout.spacing,
  shadow: layout.shadow,
  screen: layout.screen,
  button: layout.button,
};

// ⭐ PRO THEME (premium users)
export const proTheme: Theme = {
  background: "#050A1A",
  text: "#F8F8F8",
  card: "#0F162E",

  accent: "#FFD700",
  gold: "#FFD700",
  goldDeep: "#C5A100",
  goldSoftGlow: "rgba(255, 215, 0, 0.45)",

  success: "#4CAF50",
  danger: "#FF4D4D",
  muted: "#A0A0A0",
  secondary: "#4FA3FF",

  white: "#FFFFFF",
  black: "#000000",

  radius: layout.radius,
  spacing: layout.spacing,
  shadow: layout.shadow,
  screen: layout.screen,
  button: layout.button,
};

// ⭐ Export a theme map if needed
export const themes = {
  free: freeTheme,
  pro: proTheme,
};
