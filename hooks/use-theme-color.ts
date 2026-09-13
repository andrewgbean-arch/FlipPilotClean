import { useColorScheme } from "react-native";
import { Colors } from "../src/styles/theme/colors";

type ThemeProps = {
  light?: string;
  dark?: string;
};

export function useThemeColor(
  props: ThemeProps,
  colorName: keyof typeof Colors.light
) {
  const colorScheme = useColorScheme() ?? "light";

  const safeScheme: "light" | "dark" =
    colorScheme === "unspecified" ? "light" : colorScheme;

  const colorFromProps = props[safeScheme];
  if (colorFromProps) {
    return colorFromProps;
  }

  // ⭐ FIX: return the actual string value, not the whole object
  return Colors[safeScheme][colorName];
}

