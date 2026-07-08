import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

export default function GoldParticlesBurst({ trigger }: { trigger: boolean }) {

  const particles = [...Array(3)].map(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(0),
    translateX: new Animated.Value(0),
  }));

  useEffect(() => {
    if (trigger) {
      particles.forEach((p, i) => {
        p.opacity.setValue(1);
        p.translateY.setValue(0);
        p.translateX.setValue(0);

        Animated.parallel([
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(p.translateY, {
            toValue: -20 - i * 6,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(p.translateX, {
            toValue: (i - 1) * 10,
            duration: 700,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [trigger]);

  return (
    <>
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: "#FFD700",
            opacity: p.opacity,
            transform: [
              { translateY: p.translateY },
              { translateX: p.translateX },
            ],
          }}
        />
      ))}
    </>
  );
}
