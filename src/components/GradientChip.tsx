import { LinearGradient } from "expo-linear-gradient";
import { Text } from "react-native";
import { Theme } from "@/styles/theme";

interface GradientChipProps {
  text: string;
  theme: Theme;
}

export function GradientChip({ text, theme }: GradientChipProps) {
  return (
    <LinearGradient
      colors={[theme.accent, theme.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: theme.radius.md,
        marginBottom: 10,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          color: theme.background,
          fontWeight: "700",
        }}
      >
        {text}
      </Text>
    </LinearGradient>
  );
}
