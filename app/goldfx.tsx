// ------------------------------------------------------
// LAB — INTERACTIVE NEON HYBRID REACTOR + SLIDERS
// ------------------------------------------------------
import React, { useRef, useEffect, useState } from "react";
import {
  Animated,
  StyleSheet,
  Pressable,
  PanResponder,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import Slider from "@react-native-community/slider";

import { useTheme } from "@/src/context/ThemeContext";
import ThemedView from "@/src/styles/theme/ThemedView";
import ThemedText from "@/src/styles/theme/ThemedText";

export default function GoldFXScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();

  // ------------------------------------------------------
  // SLIDER STATE
  // ------------------------------------------------------
  const [intensity, setIntensity] = useState(0.5);   // 0 → calm, 1 → strong
  const [speed, setSpeed] = useState(0.5);           // visual speed factor
  const [flashPower, setFlashPower] = useState(0.5); // molten flash strength

  // ------------------------------------------------------
  // BASE PULSE + ORBIT
  // ------------------------------------------------------
  const pulse = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2600,
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: false,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: false,
      })
    ).start();
  }, []);

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.9],
  });

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.1 + speed * 0.4],
  });

  const orbitRotate = orbit.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", `${360 + speed * 180}deg`],
  });

  // ------------------------------------------------------
  // INTERACTIVE FX — SHOCKWAVE, PARTICLE TRAIL, FLASH
  // ------------------------------------------------------
  const shockwave = useRef(new Animated.Value(0)).current;

  const triggerShockwave = () => {
    shockwave.setValue(0);
    Animated.timing(shockwave, {
      toValue: 1,
      duration: 600,
      useNativeDriver: false,
    }).start();
  };

  const shockwaveScale = shockwave.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 2.4 * (0.5 + intensity)],
  });

  const shockwaveOpacity = shockwave.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 0],
  });

  const [trailPos, setTrailPos] = useState({ x: -999, y: -999 });
  const trailOpacity = useRef(new Animated.Value(0)).current;

  const showTrail = (x: number, y: number) => {
    setTrailPos({ x, y });
    trailOpacity.setValue(1);
    Animated.timing(trailOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: false,
    }).start();
  };

  const flash = useRef(new Animated.Value(0)).current;

  const triggerFlash = () => {
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, {
        toValue: 1,
        duration: 120,
        useNativeDriver: false,
      }),
      Animated.timing(flash, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const flashOpacity = flash.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4 + flashPower * 0.6],
  });

  // ------------------------------------------------------
  // TOUCH HANDLER
  // ------------------------------------------------------
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,

      onPanResponderGrant: (_, gesture) => {
        triggerShockwave();
        triggerFlash();
        showTrail(gesture.x0, gesture.y0);
      },

      onPanResponderMove: (_, gesture) => {
        showTrail(gesture.moveX, gesture.moveY);
      },

      onPanResponderRelease: () => {},
    })
  ).current;

  // ------------------------------------------------------
  // RENDER
  // ------------------------------------------------------
  return (
    <ThemedView
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 20,
        },
      ]}
    >
      <ThemedText style={[styles.title, { color: theme.accent }]}>
        GoldFX Lab
      </ThemedText>

      <ThemedText style={[styles.subtitle, { color: theme.accent }]}>
        Interactive Neon Hybrid Reactor
      </ThemedText>

      {/* FULL-SCREEN REACTOR */}
      <View style={styles.reactorWrapper} {...panResponder.panHandlers}>
        {/* Shockwave */}
        <Animated.View
          style={[
            styles.shockwave,
            {
              opacity: shockwaveOpacity,
              transform: [{ scale: shockwaveScale }],
              borderColor: "#FFD700",
            },
          ]}
        />

        {/* Particle trail */}
        <Animated.View
          style={[
            styles.trailDot,
            {
              opacity: trailOpacity,
              left: trailPos.x - 10,
              top: trailPos.y - 10,
              backgroundColor: `rgba(255, 234, 138, ${
                0.4 + intensity * 0.6
              })`,
            },
          ]}
        />

        {/* Molten flash */}
        <Animated.View
          style={[
            styles.flashOverlay,
            {
              opacity: flashOpacity,
              backgroundColor: "#FFF7D1",
            },
          ]}
        />

        {/* Reactor core */}
        <Animated.View
          style={[
            styles.reactorContainer,
            {
              borderColor: theme.goldDeep,
              shadowColor: theme.goldDeep,
              shadowOpacity: 0.6,
              shadowRadius: 40,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.glowRing,
              {
                opacity: glowOpacity,
                transform: [{ scale: ringScale }],
                borderColor: "#FFD700",
              },
            ]}
          />

          <Animated.View
            style={[
              styles.orbitRing,
              {
                borderColor: "#FFEA8A",
                transform: [{ rotate: orbitRotate }],
              },
            ]}
          />

          <Animated.View
            style={[
              styles.core,
              {
                backgroundColor: "#FFD700",
                shadowColor: "#FFD700",
                shadowOpacity: glowOpacity,
              },
            ]}
          />
        </Animated.View>
      </View>

      {/* CONTROL PANEL WITH SLIDERS */}
      <ThemedView
        style={[
          styles.panel,
          {
            backgroundColor: theme.card,
            borderColor: theme.goldDeep,
          },
        ]}
      >
        <ThemedText style={[styles.panelTitle, { color: theme.accent }]}>
          Reactor Controls
        </ThemedText>

        {/* INTENSITY */}
        <ThemedText style={[styles.panelText, { color: theme.accent }]}>
          Intensity
        </ThemedText>
        <Slider
          value={intensity}
          onValueChange={setIntensity}
          minimumValue={0}
          maximumValue={1}
          step={0.01}
          minimumTrackTintColor="#FFD700"
          maximumTrackTintColor="#444"
          thumbTintColor="#FFD700"
        />

        {/* SPEED */}
        <ThemedText
          style={[
            styles.panelText,
            { color: theme.accent, marginTop: 12 },
          ]}
        >
          Speed
        </ThemedText>
        <Slider
          value={speed}
          onValueChange={setSpeed}
          minimumValue={0}
          maximumValue={1}
          step={0.01}
          minimumTrackTintColor="#FFEA8A"
          maximumTrackTintColor="#444"
          thumbTintColor="#FFEA8A"
        />

        {/* FLASH POWER */}
        <ThemedText
          style={[
            styles.panelText,
            { color: theme.accent, marginTop: 12 },
          ]}
        >
          Flash Power
        </ThemedText>
        <Slider
          value={flashPower}
          onValueChange={setFlashPower}
          minimumValue={0}
          maximumValue={1}
          step={0.01}
          minimumTrackTintColor="#FFF7D1"
          maximumTrackTintColor="#444"
          thumbTintColor="#FFF7D1"
        />

        {/* BACK BUTTON */}
        <Pressable
          style={[styles.backButton, { borderColor: theme.goldDeep }]}
          onPress={() => router.back()}
        >
          <ThemedText style={[styles.backText, { color: theme.accent }]}>
            Back to FlipPilot
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: {
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.8,
    marginBottom: 20,
  },

  reactorWrapper: {
    flex: 1,
    marginBottom: 20,
  },

  shockwave: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    alignSelf: "center",
    top: "40%",
  },

  trailDot: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
  },

  flashOverlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },

  reactorContainer: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  glowRing: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 4,
  },

  orbitRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
  },

  core: {
    width: 80,
    height: 80,
    borderRadius: 40,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },

  panel: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
  },

  panelTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  panelText: { fontSize: 13, marginBottom: 4 },

  backButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderWidth: 2,
    borderRadius: 999,
    alignItems: "center",
  },

  backText: { fontSize: 14, fontWeight: "700" },
});
