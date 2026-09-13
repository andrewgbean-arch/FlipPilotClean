import { useContext } from "react";
import { ThemeContext } from "./ThemeContext";
import type { Theme } from "./theme";

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

