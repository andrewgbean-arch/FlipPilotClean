import React, { useEffect, useRef } from "react";
import { Animated, Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

export default function GoldFlashOverlay({ trigger }: { trigger: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger) {
      opacity.setValue(0.35);

      Animated.timing(opacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }
  }, [trigger]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width,
        height,
        backgroundColor: "#FFD700",
        opacity,
        top: 0,
        left: 0,
      }}
    />
  );
}
