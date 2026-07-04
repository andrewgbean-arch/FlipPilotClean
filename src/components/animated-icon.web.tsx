import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const ENTER_DURATION = 600;

// --- Keyframes for entrance animations ---
const reactorEnter = new Keyframe({
  0: {
    transform: [{ scale: 0.4 }],
    opacity: 0,
  },
  60: {
    transform: [{ scale: 1.3 }],
    opacity: 1,
    easing: Easing.elastic(1.2),
  },
  100: {
    transform: [{ scale: 1 }],
    opacity: 1,
  },
});

const logoEnter = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.6 }] },
  70: {
    opacity: 0,
    transform: [{ scale: 1.3 }],
    easing: Easing.elastic(1.2),
  },
  100: { opacity: 1, transform: [{ scale: 1 }] },
});

// --- Glow bloom animation ---
const glowEnter = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.8 }] },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.8),
  },
});

export function AnimatedIcon() {
  // Rotation values for dual-core reactor
  const outerRotation = useSharedValue(0);
  const innerRotation = useSharedValue(0);

  // Glow pulse
  const glowPulse = useSharedValue(1);

  // Particle drift
  const particleX = useSharedValue(0);
  const particleY = useSharedValue(0);
  const particleOpacity = useSharedValue(0);

  // --- Reactor rotation loop ---
  outerRotation.value = withRepeat(
    withTiming(360, { duration: 6000, easing: Easing.linear }),
    -1,
    false
  );

  innerRotation.value = withRepeat(
    withTiming(-360, { duration: 4000, easing: Easing.linear }),
    -1,
    false
  );

  // --- Glow pulse loop ---
  glowPulse.value = withRepeat(
    withSequence(
      withTiming(1.2, { duration: 1800 }),
      withTiming(1, { duration: 1800 })
    ),
    -1,
    false
  );

  // --- Particle drift loop (subtle P1 mode) ---
  particleOpacity.value = withRepeat(
    withSequence(
      withTiming(0.4, { duration: 1200 }),
      withTiming(0, { duration: 1200 })
    ),
    -1,
    false
  );

  particleX.value = withRepeat(
    withSequence(
      withTiming(6, { duration: 1200 }),
      withTiming(-6, { duration: 1200 })
    ),
    -1,
    false
  );

  particleY.value = withRepeat(
    withSequence(
      withTiming(-4, { duration: 1200 }),
      withTiming(4, { duration: 1200 })
    ),
    -1,
    false
  );

  // --- Animated styles ---
  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${outerRotation.value}deg` }],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${innerRotation.value}deg` }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowPulse.value }],
  }));

  const particleStyle = useAnimatedStyle(() => ({
    opacity: particleOpacity.value,
    transform: [
      { translateX: particleX.value },
      { translateY: particleY.value },
    ],
  }));

  return (
    <View style={styles.iconContainer}>
      {/* Glow */}
      <Animated.View
        entering={glowEnter.duration(ENTER_DURATION)}
        style={[styles.glow, glowStyle]}
      >
        <Image
          style={styles.glow}
          source={require("@/assets/images/logo-glow.png")}
        />
      </Animated.View>

      {/* Outer reactor ring */}
      <Animated.View
        entering={reactorEnter.duration(ENTER_DURATION)}
        style={[styles.outerRing, outerStyle]}
      />

      {/* Inner reactor ring */}
      <Animated.View style={[styles.innerRing, innerStyle]} />

      {/* Particle drift */}
      <Animated.View style={[styles.particle, particleStyle]} />

      {/* Expo logo */}
      <Animated.View
        entering={logoEnter.duration(ENTER_DURATION)}
        style={styles.logoContainer}
      >
        <Image
          style={styles.logo}
          source={require("@/assets/images/expo-logo.png")}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: 128,
    height: 128,
  },

  glow: {
    width: 200,
    height: 200,
    position: "absolute",
  },

  outerRing: {
    width: 128,
    height: 128,
    borderRadius: 128,
    borderWidth: 3,
    borderColor: "#FFD700", // gold
    position: "absolute",
  },

  innerRing: {
    width: 70,
    height: 70,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: "#00A8FF", // blue
    position: "absolute",
  },

  particle: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.4)",
    position: "absolute",
  },

  logoContainer: {
    justifyContent: "center",
    alignItems: "center",
  },

  logo: {
    width: 76,
    height: 71,
    position: "absolute",
  },
});
