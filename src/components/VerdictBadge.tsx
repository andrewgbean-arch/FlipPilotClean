import React from "react";
import { View, ViewStyle } from "react-native";
import ThemedText from "@/src/styles/theme/ThemedText";

interface VerdictBadgeProps {
  verdict?: string;
  style?: ViewStyle | ViewStyle[];
}

export default function VerdictBadge({ verdict, style }: VerdictBadgeProps) {
  if (!verdict) return null;

  return (
    <View
      style={[
        {
          backgroundColor: "#FFD700",
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 10,
          alignSelf: "flex-start",
          marginBottom: 10,
        },
        style,
      ]}
    >
      <ThemedText style={{ color: "#0A1128", fontWeight: "900" }}>
        {verdict}
      </ThemedText>
    </View>
  );
}
