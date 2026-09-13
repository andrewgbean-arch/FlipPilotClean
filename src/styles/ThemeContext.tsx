import React, { createContext, useState, useContext, useMemo } from "react";
import { themes, Theme } from "./theme";
import { useUserSettings } from "@/features/settings/UserSettingsContext";

type ThemeContextType = Theme & {
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextType>({
  ...themes.free,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeMode] = useState<"free" | "pro">("free");
  const { isDealer } = useUserSettings();

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === "free" ? "pro" : "free"));
  };

  const value = useMemo<ThemeContextType>(() => {
    // ⭐ Dealer Mode Gold Theme Override
    if (isDealer) {
      return {
        ...themes.pro, // base on pro theme
        accent: "#FFD700",
        background: "#0A0A0A",
        card: "#1A1A1A",
        text: "#FFFFFF",
        secondary: "#C0C0C0",
        toggleTheme,
      };
    }

    // ⭐ Normal Free/Pro Theme
    const base = themeMode === "free" ? themes.free : themes.pro;

    return {
      ...base,
      toggleTheme,
    };
  }, [themeMode, isDealer]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

