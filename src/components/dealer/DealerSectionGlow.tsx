import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/styles/ThemeContext";

export default function DealerSectionGlow({ title }: { title: string }) {
  const theme = useTheme();

  return (
    <View style={{ marginTop: 28, marginBottom: 12 }}>
      <Text
        style={{
          color: theme.accent,
          fontSize: 20,
          fontWeight: "900",
          textShadowColor: theme.goldDeep,
          textShadowRadius: 12,
          textShadowOffset: { width: 0, height: 0 },
          letterSpacing: 0.6,
        }}
      >
        {title}
      </Text>

      <View
        style={{
          height: 3,
          backgroundColor: theme.goldSoftGlow,
          borderRadius: 6,
          marginTop: 6,
          shadowColor: theme.goldDeep,
          shadowOpacity: 0.4,
          shadowRadius: 6,
        }}
      />
    </View>
  );
}
