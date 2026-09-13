import React, { useEffect, useRef } from "react";
import {
  Animated,
  View,
  StyleSheet,
  ViewStyle,
  Pressable,
} from "react-native";
import { useTheme } from "@/styles/ThemeContext";

interface GlowPulseCardProps {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
}

export default function GlowPulseCard({ children, style, onPress }: GlowPulseCardProps) {
  const theme = useTheme();

  // Pulse glow
  const pulse = useRef(new Animated.Value(0)).current;

  // Parallax shine
  const shine = useRef(new Animated.Value(0)).current;

  // Tap ripple
  const ripple = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: false,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(shine, {
          toValue: 1,
          duration: 2600,
          useNativeDriver: false,
        }),
        Animated.timing(shine, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const glow = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.85],
  });

  const shimmer = shine.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,215,0,0.12)", "rgba(255,215,0,0.35)"],
  });

  const rippleScale = ripple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.08],
  });

  const triggerRipple = () => {
    ripple.setValue(0);
    Animated.timing(ripple, {
      toValue: 1,
      duration: 350,
      useNativeDriver: false,
    }).start(() => ripple.setValue(0));

    onPress?.();
  };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          shadowColor: theme.goldDeep,
          shadowOpacity: glow,
          transform: [{ scale: rippleScale }],
        },
        style,
      ]}
    >
      {/* Animated gold border */}
      <Animated.View
        style={[
          styles.shimmerBorder,
          {
            borderColor: theme.goldDeep,
            backgroundColor: shimmer,
          },
        ]}
      />

      {/* Sparkles */}
      <Animated.View
        style={[
          styles.sparkleLayer,
          {
            opacity: glow,
          },
        ]}
      >
        <View style={styles.sparkle} />
        <View style={[styles.sparkle, { top: 22, left: 60 }]} />
        <View style={[styles.sparkle, { top: 48, left: 22 }]} />
      </Animated.View>

      {/* Inner card */}
      <Pressable onPress={triggerRipple} style={{ borderRadius: 16 }}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.card,
            },
          ]}
        >
          {children}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    position: "relative",
  },

  shimmerBorder: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderWidth: 2,
    borderRadius: 20,
    opacity: 0.9,
  },

  sparkleLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
  },

  sparkle: {
    width: 6,
    height: 6,
    backgroundColor: "#FFD700",
    borderRadius: 3,
    position: "absolute",
    top: 10,
    left: 30,
    opacity: 0.85,
  },

  card: {
    padding: 18,
    borderRadius: 16,
  },
});
