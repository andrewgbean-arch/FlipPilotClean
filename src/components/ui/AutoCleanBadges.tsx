import React from "react";
import { View, Text } from "react-native";

interface BackgroundData {
  style?: "white" | "flipBlue" | "goldGlow";
}

interface Theme {
  goldDeep: string;
  muted: string;
}

interface Props {
  data?: BackgroundData;
  theme: Theme;
}

export default function BackgroundBadges({ data, theme }: Props) {
  if (!data) return null;

  return (
    <View style={{ marginTop: 6 }}>
      <Text style={{ color: theme.goldDeep, fontSize: 12 }}>
        Background: {data.style === "white"
          ? "White Studio"
          : data.style === "flipBlue"
          ? "FlipPilot Blue"
          : "Gold Glow"}
      </Text>
    </View>
  );
}

