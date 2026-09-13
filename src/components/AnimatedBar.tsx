import { View, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { Theme } from "@/styles/theme";

interface AnimatedBarProps {
  value: number; // 0–100
  theme: Theme;
}

export function AnimatedBar({ value, theme }: AnimatedBarProps) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: value,
      duration: theme.animation.normal,
      useNativeDriver: false,
    }).start();
  }, [value]);

  return (
    <View
      style={{
        height: 10,
        backgroundColor: theme.cardElevated,
        borderRadius: theme.radius.sm,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          height: 10,
          width: widthAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
          backgroundColor: theme.accent,
        }}
      />
    </View>
  );
}
