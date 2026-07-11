import { createContext, ReactNode, useContext, useState } from "react";
import { Theme, freeTheme, proTheme } from "@/styles/theme";

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
