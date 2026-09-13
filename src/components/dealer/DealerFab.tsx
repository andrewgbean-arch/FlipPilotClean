import React, { useEffect, useRef } from "react";
import { Animated, TouchableOpacity, Text, View } from "react-native";
import { useTheme } from "@/styles/ThemeContext";
import { useUserSettings } from "@/features/settings/UserSettingsContext";
import { router } from "expo-router";
import { layout } from "@/styles/layout";

type DealerFabProps = {
  vehicleId?: string | number;
};

export default function DealerFab({ vehicleId }: DealerFabProps) {
  const theme = useTheme();
  const { isDealer } = useUserSettings();

  // ⭐ Pulse animation
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  if (!isDealer) return null;

  // ⭐ Interpolated glow + scale
  const glowColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.goldSoftGlow, theme.goldHardGlow],
  });

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: layout.fab.offset.bottom,
        right: layout.fab.offset.right,

        transform: [{ scale }],

        shadowColor: glowColor as any,
        shadowOpacity: 0.9,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: "/dealer-dashboard",
            params: {
              id: vehicleId,
              lead: JSON.stringify({}),
              buyer: JSON.stringify({}),
            },
          })
        }
        style={{
          backgroundColor: theme.accent,
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: layout.radius.full,
          borderWidth: 1,
          borderColor: theme.goldHardGlow,
        }}
      >
        <Text
          style={{
            color: theme.background,
            fontWeight: "800",
            fontSize: 14,
          }}
        >
          Dealer V9
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
