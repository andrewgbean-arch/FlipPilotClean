import { useColorScheme } from "react-native";

export function useTheme() {
  const scheme = useColorScheme();

  const light = {
    text: "#000000",
    card: "#ffffff",
    primary: "#0A1128",
    accent: "#FFD700",
  };

  const dark = {
    text: "#ffffff",
    card: "#0A1128",
    primary: "#ffffff",
    accent: "#FFD700",
  };

  return scheme === "dark" ? dark : light;
}


