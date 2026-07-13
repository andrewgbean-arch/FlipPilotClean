import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import ThemedText from "@/src/styles/theme/ThemedText";
import { useTheme } from "@/src/context/ThemeContext";
import { getMotStatus } from "@/src/car/carUtils";

interface MotBadgeProps {
  expiry?: string;
}

interface MotStyle {
  bg: string;
  text: string;
  label: string;
}

export default function MotBadge({ expiry }: MotBadgeProps) {
  const theme = useTheme();
  const status = getMotStatus(expiry);

  const styles: Record<string, MotStyle> = {
    valid: { bg: "#2ecc71", text: "#0A1128", label: "MOT Valid" },
    dueSoon: { bg: "#f1c40f", text: "#0A1128", label: "MOT Due Soon" },
    expired: { bg: "#e74c3c", text: "#ffffff", label: "MOT Expired" },
    unknown: { bg: theme.card, text: theme.text, label: "No MOT Data" },
  };

  const s = styles[status] ?? styles.unknown;

  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale: pulse }], alignSelf: "flex-start", marginBottom: 12 }}>
      <View
        style={{
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 12,
          backgroundColor: s.bg,
        }}
      >
        <ThemedText style={{ color: s.text, fontWeight: "900" }}>{s.label}</ThemedText>
      </View>
    </Animated.View>
  );
}
