import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

export interface GoldTrailProps {
  trigger?: boolean; // ← added safely
}

export default function GoldTrail({ trigger }: GoldTrailProps) {
  const trailOpacity = useRef(new Animated.Value(0)).current;
  const trailX = useRef(new Animated.Value(0)).current;
  const trailY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger) {
      // Reset values
      trailOpacity.setValue(0);
      trailX.setValue(0);
      trailY.setValue(0);

      Animated.parallel([
        Animated.timing(trailOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(trailX, {
          toValue: 12,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(trailY, {
          toValue: -12,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.timing(trailOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [trigger]);

  return (
    <Animated.View
      style={[
        styles.trail,
        {
          opacity: trailOpacity,
          transform: [
            { translateX: trailX },
            { translateY: trailY },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  trail: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255, 215, 0, 0.55)", // gold glow
    top: -40,
    alignSelf: "center",
  },
});

