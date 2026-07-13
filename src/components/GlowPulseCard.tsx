import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";

interface GlowPulseCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export default function GlowPulseCard({ children, style }: GlowPulseCardProps) {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1800, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 1800, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const shadow = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  });

  return (
    <Animated.View
      style={[
        style,
        {
          shadowColor: "#FFD700",
          shadowOpacity: 0.25,
          shadowRadius: shadow,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
