import { createContext, ReactNode, useContext, useState } from "react";

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
}

const freeTheme: Theme = {
  background: "#0A0F1F",
  text: "#FFFFFF",
  card: "#111A2C",

  accent: "#FFD700",
  gold: "#FFD700",
  goldDeep: "#C9A100",
  goldSoftGlow: "rgba(255,215,0,0.25)",

  success: "#4CAF50",
  danger: "#F44336",
  muted: "rgba(255,255,255,0.6)",
  secondary: "#1C2F4A",
  white: "#FFFFFF",
  black: "#000000",
};

const proTheme: Theme = {
  background: "#05070D",
  text: "#FFFFFF",
  card: "#0D1422",

  accent: "#FFD700",
  gold: "#FFD700",
  goldDeep: "#C9A100",
  goldSoftGlow: "rgba(255,215,0,0.25)",

  success: "#FFD700", // premium gold meters
  danger: "#F44336",
  muted: "rgba(255,255,255,0.6)",
  secondary: "#1C2F4A",
  white: "#FFFFFF",
  black: "#000000",
};

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;

  isPro: boolean;
  togglePro: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDark, setIsDark] = useState(true);
  const [isPro, setIsPro] = useState(false);

  const toggleTheme = () => setIsDark((prev) => !prev);
  const togglePro = () => setIsPro((prev) => !prev);

  return (
    <ThemeContext.Provider
      value={{
        theme: isPro ? proTheme : freeTheme,
        toggleTheme,
        isDark,
        isPro,
        togglePro,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx.theme;
};

export const usePro = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("usePro must be used inside ThemeProvider");
  return { isPro: ctx.isPro, togglePro: ctx.togglePro };
};
