import React, { useEffect } from "react";
import { StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");
const NUM_PARTICLES = 80;

export default function SparklesOverlay() {
  return (
    <Animated.View pointerEvents="none" style={styles.container}>
      {Array.from({ length: NUM_PARTICLES }).map((_, i) => (
        <Particle key={i} index={i} />
      ))}
    </Animated.View>
  );
}

function Particle({ index }: { index: number }) {
  const x = useSharedValue(Math.random() * width);
  const y = useSharedValue(Math.random() * height);

  useEffect(() => {
    // Smooth floating motion
    x.value = withRepeat(
      withTiming(Math.random() * width, {
        duration: 9000 + index * 40,
      }),
      -1,
      true
    );

    y.value = withRepeat(
      withTiming(Math.random() * height, {
        duration: 12000 + index * 60,
      }),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: x.value,
    top: y.value,
    opacity: 0.35,
  }));

  const size = 2 + (index % 3);

  return (
    <Animated.View
      style={[
        styles.particle,
        style,
        {
          width: size,
          height: size,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
  },
  particle: {
    backgroundColor: "#FFD700",
    borderRadius: 999,
    shadowColor: "#FFD700",
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});
