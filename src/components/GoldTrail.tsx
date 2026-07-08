import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, ViewStyle } from "react-native";
import ThemedText from "./ThemedText";
import GoldParticlesBurst from "./GoldParticlesBurst";
import GoldTrail from "./GoldTrail";

interface GoldButtonProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
  theme: {
    goldDeep: string;
    accent: string;
    black: string;
  };
}

export default function GoldButton({
  title,
  subtitle,
  onPress,
  theme,
}: GoldButtonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const shadowDepth = useRef(new Animated.Value(20)).current;
  const gradientShift = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const orbitFast = useRef(new Animated.Value(0)).current;
  const holdGlow = useRef(new Animated.Value(0)).current;

  const [spark, setSpark] = useState(false);
  const [trail, setTrail] = useState(false);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: false,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: false,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2200,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: 6000,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(orbitFast, {
        toValue: 1,
        duration: 3500,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const glow = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  const holdGlowIntensity = holdGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  });

  const breatheScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  const borderGradient = gradientShift.interpolate({
    inputRange: [0, 1],
    outputRange: ["#FFD700", "#FFB300"],
  });

  const orbitRotate = orbit.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const orbitRotateFast = orbitFast.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-360deg"],
  });

  const animatePress = () => {
    setSpark(true);
    setTrail(true);

    ripple.setValue(0);
    shadowDepth.setValue(20);
    gradientShift.setValue(0);
    holdGlow.setValue(0);

    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 0.92,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }),
      ]),

      Animated.timing(ripple, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false,
      }),

      Animated.timing(shadowDepth, {
        toValue: 6,
        duration: 300,
        useNativeDriver: false,
      }),

      Animated.timing(gradientShift, {
        toValue: 1,
        duration: 800,
        useNativeDriver: false,
      }),

      Animated.timing(holdGlow, {
        toValue: 1,
        duration: 900,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const rippleSize = ripple.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 260],
  });

  const rippleOpacity = ripple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0],
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          borderColor: borderGradient,
          shadowColor: theme.goldDeep,
          shadowOpacity: glow,
          shadowRadius: shadowDepth,
          transform: [{ scale: breatheScale }],
        } as unknown as ViewStyle,
      ]}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: 260,
          height: 260,
          borderRadius: 130,
          borderWidth: 1.5,
          borderColor: "rgba(255, 215, 0, 0.35)",
          alignSelf: "center",
          top: -120,
          transform: [{ rotate: orbitRotate }],
        }}
      />

      <Animated.View
        style={{
          position: "absolute",
          width: 260,
          height: 260,
          borderRadius: 130,
          borderWidth: 1.5,
          borderColor: "rgba(255, 215, 0, 0.25)",
          alignSelf: "center",
          top: -120,
          transform: [{ rotate: orbitRotateFast }],
        }}
      />

      <GoldParticlesBurst trigger={spark} />
      <GoldTrail trigger={trail} />

      <Animated.View
        style={{
          position: "absolute",
          width: rippleSize,
          height: rippleSize,
          borderRadius: 200,
          backgroundColor: theme.goldDeep,
          opacity: rippleOpacity,
          alignSelf: "center",
          top: -100,
        }}
      />

      <Pressable
        style={[
          styles.button,
          { backgroundColor: theme.accent, transform: [{ scale: holdGlowIntensity }] },
        ]}
        onPress={() => {
          animatePress();
          onPress();
        }}
      >
        <ThemedText style={[styles.title, { color: theme.black }]}>
          {title}
        </ThemedText>

        {subtitle && (
          <ThemedText style={[styles.subtitle, { color: theme.black }]}>
            {subtitle}
          </ThemedText>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    alignSelf: "center",
    borderWidth: 3,
    borderRadius: 20,
    marginTop: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    flexWrap: "wrap",
    width: "100%",
  },
  subtitle: {
    opacity: 0.85,
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
});
