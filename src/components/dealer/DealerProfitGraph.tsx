import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";
import Svg, { Polyline, Defs, LinearGradient, Stop } from "react-native-svg";

// ⭐ Types for props
type DealerProfitGraphProps = {
  vehicles: Array<{
    profit?: number;
  }>;
  theme: {
    accent: string;
    background: string;
    card: string;
    text: string;
    secondary: string;
  };
};

// ⭐ Animated Polyline wrapper
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

export default function DealerProfitGraph({
  vehicles,
  theme,
}: DealerProfitGraphProps) {
  // Build graph points
  const points = vehicles
    .map((v, i) => `${i * 20},${200 - (v.profit ?? 0) / 10}`)
    .join(" ");

  // Animation value
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 1500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, []);

  // Animate strokeDashoffset to draw the line
  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0], // start hidden → end fully drawn
  });

  return (
    <View style={{ marginTop: 30 }}>
      <Text
        style={{
          fontSize: 22,
          fontWeight: "700",
          color: theme.accent,
          marginBottom: 10,
        }}
      >
        Profit Graph
      </Text>

      <Svg height="200" width="100%">
        <Defs>
          <LinearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFD700" stopOpacity="1" />
            <Stop offset="1" stopColor="#B8860B" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Glow layer */}
        <Polyline
          points={points}
          fill="none"
          stroke="#FFD700"
          strokeWidth="10"
          opacity={0.15}
        />

        {/* Animated main line */}
        <AnimatedPolyline
          points={points}
          fill="none"
          stroke="url(#gold)"
          strokeWidth="4"
          strokeDasharray="500"
          strokeDashoffset={strokeDashoffset}
        />
      </Svg>
    </View>
  );
}
