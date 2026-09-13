import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

export default function GoldFlashOverlay({ trigger }: { trigger: number }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Every new timestamp triggers the flash
    opacity.setValue(0.35);

    Animated.timing(opacity, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [trigger]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#FFD700",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
}
