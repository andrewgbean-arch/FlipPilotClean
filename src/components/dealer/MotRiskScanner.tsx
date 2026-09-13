import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";

// ⭐ Types for props
type MotRiskScannerProps = {
  vehicles: Array<{
    id: string | number;
    title: string;
    mot?: {
      motExpiry?: string;
    };
  }>;
  theme: {
    accent: string;
    background: string;
    card: string;
    text: string;
    secondary: string;
  };
};

export default function MotRiskScanner({
  vehicles,
  theme,
}: MotRiskScannerProps) {
  const risky = vehicles.filter((v) => {
    if (!v.mot?.motExpiry) return false;
    const expiry = new Date(v.mot.motExpiry);
    return expiry.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 30; // < 30 days
  });

  // ⭐ Animation: pulse red glow for risky vehicles
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const pulseColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255, 0, 0, 0.15)", "rgba(255, 0, 0, 0.35)"],
  });

  return (
    <View style={{ marginTop: 30 }}>
      <Text
        style={{
          fontSize: 22,
          fontWeight: "700",
          color: theme.accent,
        }}
      >
        MOT Risk Scanner
      </Text>

      {risky.length === 0 && (
        <Text style={{ color: theme.secondary, marginTop: 10 }}>
          No vehicles at MOT risk.
        </Text>
      )}

      {risky.map((v, i) => (
        <RiskCard key={v.id} vehicle={v} index={i} theme={theme} pulseColor={pulseColor} />
      ))}
    </View>
  );
}

function RiskCard({
  vehicle,
  index,
  theme,
  pulseColor,
}: {
  vehicle: MotRiskScannerProps["vehicles"][number];
  index: number;
  theme: MotRiskScannerProps["theme"];
  pulseColor: Animated.AnimatedInterpolation<string>;
}) {
  // ⭐ Fade-in animation per card
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 500,
      delay: index * 150,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <Animated.View
      style={{
        marginTop: 10,
        padding: 12,
        backgroundColor: theme.card,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: "red",
        shadowColor: "red",
        shadowOpacity: 0.4,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
        opacity: fade,
      }}
    >
      {/* ⭐ Animated red pulse overlay */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: pulseColor,
          borderRadius: 10,
        }}
      />

      <Text style={{ color: theme.text, fontWeight: "700" }}>
        {vehicle.title}
      </Text>

      <Text style={{ color: theme.secondary }}>
        MOT Expiring: {vehicle.mot?.motExpiry}
      </Text>
    </Animated.View>
  );
}
