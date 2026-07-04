import React, { useEffect } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

// ------------------------------------------------------
// TYPES
// ------------------------------------------------------
interface GoldParticlesProps {
  theme: {
    goldDeep: string;
  };
}

interface Particle {
  x: number;
  y: number;
  size: number;
  anim: Animated.Value;
}

// ------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------
const { width, height } = Dimensions.get("window");

// ------------------------------------------------------
// COMPONENT
// ------------------------------------------------------
export default function GoldParticles({ theme }: GoldParticlesProps) {
  const particles: Particle[] = [...Array(25)].map(() => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() * 4 + 2,
    anim: new Animated.Value(Math.random()),
  }));

  useEffect(() => {
    particles.forEach((p) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(p.anim, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: false,
          }),
          Animated.timing(p.anim, {
            toValue: 0,
            duration: 4000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => {
        const opacity = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.1, 0.8],
        });

        const translateY = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -40],
        });

        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: theme.goldDeep,
              opacity,
              transform: [{ translateY }],
            }}
          />
        );
      })}
    </View>
  );
}
