import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

export default function SettingsScreen() {
  const theme = useTheme();

  // ⭐ Unified Dealer Mode
  const { dealerMode, setDealerMode, setFlashTrigger } = useVehicleHistory();

  /* ---------------------------------------------
     ⭐ GOLD BORDER PULSE ANIMATION
  --------------------------------------------- */
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (dealerMode) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 900,
            useNativeDriver: false,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 900,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(0);
    }
  }, [dealerMode]);

  const pulseBorder = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.goldSoftGlow + "55", theme.goldDeep],
  });

  /* ---------------------------------------------
     ⭐ MAIN UI
  --------------------------------------------- */

  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: theme.background }}>
      {/* HERO HEADER */}
      <Text
        style={{
          fontSize: 32,
          fontWeight: "800",
          color: theme.accent,
          marginBottom: 10,
        }}
      >
        Settings
      </Text>

      <Text
        style={{
          color: theme.secondary,
          fontSize: 16,
          marginBottom: 30,
        }}
      >
        Personalisation, Dealer Mode & App Controls
      </Text>

      {/* DEALER MODE CARD */}
      <Animated.View
        style={{
          backgroundColor: theme.card,
          padding: 20,
          borderRadius: 18,
          borderWidth: 2,
          borderColor: pulseBorder,
          shadowColor: theme.goldDeep,
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          marginBottom: 24,
        }}
      >
        <Text
          style={{
            color: theme.text,
            fontSize: 20,
            fontWeight: "700",
            marginBottom: 10,
          }}
        >
          Dealer Mode
        </Text>

        <Text
          style={{
            color: theme.secondary,
            fontSize: 14,
            marginBottom: 16,
          }}
        >
          Unlock Dealer Intelligence, Risk Hub, Finance Desk & Closing Engine.
        </Text>

        <TouchableOpacity
          onPress={() => {
            const newValue = !dealerMode;
            setDealerMode(newValue);

            if (newValue) {
              setFlashTrigger(Date.now()); // ⭐ Gold Flash + Confetti
            }
          }}
          style={{
            backgroundColor: dealerMode ? theme.goldDeep : theme.card,
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.goldSoftGlow,
          }}
        >
          <Text
            style={{
              color: dealerMode ? theme.black : theme.white,
              fontWeight: "700",
              fontSize: 18,
              textAlign: "center",
            }}
          >
            {dealerMode ? "Dealer Mode: ON" : "Dealer Mode: OFF"}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* DEALER BADGE */}
      {dealerMode && (
        <View
          style={{
            backgroundColor: theme.goldDeep,
            padding: 14,
            borderRadius: 14,
            alignItems: "center",
            shadowColor: theme.goldDeep,
            shadowOpacity: 0.35,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Text
            style={{
              color: theme.black,
              fontSize: 16,
              fontWeight: "800",
            }}
          >
            Dealer Mode Active ✓
          </Text>
        </View>
      )}
    </View>
  );
}
