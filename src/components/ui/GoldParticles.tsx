import React, { useEffect, useMemo } from "react";
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

// A handful is plenty: they are a hint of sparkle behind the content, and every
// extra one is more for the phone to draw while the page scrolls.
const PARTICLE_COUNT = 12;

// ------------------------------------------------------
// COMPONENT
// ------------------------------------------------------
export default function GoldParticles({ theme }: GoldParticlesProps) {
  // Made once. (They used to be rebuilt on every render, which left the first
  // set animating forever, unseen, and restarted the visible ones from a still.)
  const particles = useMemo<Particle[]>(
    () =>
      [...Array(PARTICLE_COUNT)].map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 4 + 2,
        anim: new Animated.Value(Math.random()),
      })),
    []
  );

  useEffect(() => {
    // Opacity and translate only, so the native driver runs them off the
    // JavaScript thread and scrolling is not competing with them.
    const loops = particles.map((p) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(p.anim, { toValue: 1, duration: 4000, useNativeDriver: true }),
          Animated.timing(p.anim, { toValue: 0, duration: 4000, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((loop) => loop.start());

    return () => loops.forEach((loop) => loop.stop());
  }, [particles]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
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
