import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

export default function GoldLightning({ trigger }: { trigger: number }) {


  const opacity = useRef(new Animated.Value(0)).current;
  const scaleX = useRef(new Animated.Value(0.2)).current;

useEffect(() => {
  if (trigger !== 0) {
    opacity.setValue(1);
    scaleX.setValue(0.2);

    Animated.parallel([
      Animated.timing(scaleX, {
        toValue: 1.4,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }
}, [trigger]);



  return (
    <Animated.View
      style={{
        position: "absolute",
        width: 140,
        height: 2,
        backgroundColor: "#FFD700",
        opacity,
        transform: [{ scaleX }],
        top: 12,
        left: "50%",
        marginLeft: -70,
      }}
    />
  );
}
