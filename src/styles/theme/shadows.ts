import { StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";

export const useShadows = () => {
  const theme = useTheme();

  return StyleSheet.create({
    soft: {
      shadowColor: theme.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },

    medium: {
      shadowColor: theme.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 6,
    },

    strong: {
      shadowColor: theme.black,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 10,
    },
  });
};
