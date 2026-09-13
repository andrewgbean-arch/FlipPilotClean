import React, { useEffect, useRef } from "react";
import { Animated, View, ViewStyle, Text } from "react-native";

export interface FlipScoreMeterProps {
  price: number;
  mileage: number;
  descriptionLength: number;
  style?: ViewStyle | ViewStyle[];
  small?: boolean;
}

export default function FlipScoreMeter({
  price,
  mileage,
  descriptionLength,
  style,
  small,
}: FlipScoreMeterProps) {
  // ⭐ Compute score from inputs
  const score = Math.max(
    0,
    Math.min(
      100,
      (descriptionLength / 3) +
        (price > 0 ? Math.min(40, 4000 / price) : 0) +
        (mileage > 0 ? Math.min(30, 120000 / mileage) : 0)
    )
  );

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

  const barHeight = small ? 8 : 12;
  const fontSize = small ? 12 : 16;
  const marginTop = small ? 4 : 10;

  return (
    <View style={[{ marginTop }, style]}>
      {!small && (
        <Text
          style={{
            color: "#FFD700",
            fontWeight: "900",
            marginBottom: 4,
            fontSize: 16,
          }}
        >
          FlipScore: {Math.round(score)}/100
        </Text>
      )}

      <View
        style={{
          height: barHeight,
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

      {small && (
        <Text
          style={{
            color: "#FFD700",
            fontWeight: "900",
            marginTop: 2,
            fontSize,
            textAlign: "center",
          }}
        >
          {Math.round(score)}
        </Text>
      )}
    </View>
  );
}
