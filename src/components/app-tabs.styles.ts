import { useTheme } from "../context/ThemeContext";
import { StyleSheet } from "react-native";

export function useAppTabStyles() {
  const theme = useTheme();

  return StyleSheet.create({
    pressed: {
      opacity: 0.7,
    },

    tabButtonView: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },

    backgroundSelected: {
      backgroundColor: theme.background,
    },

    backgroundElement: {
      backgroundColor: theme.background,   // FIXED
      borderColor: theme.accent,
      borderWidth: 1,
    },

    smallText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.text,                   // FIXED
    },

    tabListContainer: {
      padding: 10,
    },

    innerContainer: {
      padding: 10,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: theme.background,   // FIXED
    },

    brandText: {
      marginRight: "auto",
      color: theme.text,                   // FIXED
    },

    smallBold: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,                   // FIXED
    },

    linkText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.accent,
    },

    externalPressable: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
  });
}
