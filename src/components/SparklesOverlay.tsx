import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";

const NUM_PARTICLES = 99;

const SparklesOverlay: React.FC = () => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  // Fade shimmer loop
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { opacity }]}
    >
      {Array.from({ length: NUM_PARTICLES }).map((_, i) => {
        const translateY = new Animated.Value(0);
        const translateX = new Animated.Value(0);

        // Floating animation loop
        useEffect(() => {
          Animated.loop(
            Animated.parallel([
              Animated.sequence([
                Animated.timing(translateY, {
                  toValue: -10,
                  duration: 2500 + i * 80,
                  useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                  toValue: 10,
                  duration: 2500 + i * 80,
                  useNativeDriver: true,
                }),
              ]),
              Animated.sequence([
                Animated.timing(translateX, {
                  toValue: -5,
                  duration: 2000 + i * 60,
                  useNativeDriver: true,
                }),
                Animated.timing(translateX, {
                  toValue: 5,
                  duration: 2000 + i * 60,
                  useNativeDriver: true,
                }),
              ]),
            ])
          ).start();
        }, []);

        const size = 2 + (i % 3);

        // ⭐ IMPORTANT: numeric left/top (no strings, no percentages)
        const left = Math.random() * 400;
        const top = Math.random() * 300;

        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                width: size,
                height: size,
                left,
                top,
                transform: [{ translateY }, { translateX }],
              },
            ]}
          />
        );
      })}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill, // correct for your RN version
  },
  particle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#FFD700", // FlipPilot gold
  },
});

export default SparklesOverlay;
