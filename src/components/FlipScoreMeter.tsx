import React, { useEffect, useRef } from "react";
import { Animated, View, ViewStyle } from "react-native";
import ThemedText from "@/src/styles/theme/ThemedText";

interface FlipScoreMeterProps {
  score: number; // 0–100
  style?: ViewStyle | ViewStyle[];
}

export default function FlipScoreMeter({ score, style }: FlipScoreMeterProps) {
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fill, {
      toValue: score,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const width = fill.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[{ marginTop: 10 }, style]}>
      <ThemedText style={{ color: "#FFD700", fontWeight: "900", marginBottom: 4 }}>
        FlipScore: {score}/100
      </ThemedText>

      <View
        style={{
          height: 12,
          backgroundColor: "#1a1a1a",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={{
            height: "100%",
            backgroundColor: "#FFD700",
            width,
            borderRadius: 8,
          }}
        />
      </View>
    </View>
  );
}
