import React, { useRef, useEffect } from "react";
import { View, Text, Animated } from "react-native";
import { affordabilityEngine, BuyerProfile } from "@/features/dealer-ai/AffordabilityEngine";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export default function AffordabilitySummaryCard({
  vehicle,
  buyer,
  theme,
}: {
  vehicle: FlipRecord;
  buyer: BuyerProfile;
  theme: any;
}) {
  const score = affordabilityEngine.affordabilityScore(vehicle, buyer);
  const band = affordabilityEngine.matchBand(score);
  const recommendedDeposit = affordabilityEngine.recommendedDeposit(vehicle, buyer);

  /* ⭐ Shimmer animation */
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const shimmerColor = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,215,0,0.15)", "rgba(255,215,0,0.45)"],
  });

  return (
    <View
      style={{
        backgroundColor: theme.card,
        padding: 16,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
        marginBottom: 20,
        position: "relative",
        overflow: "hidden",

        shadowColor: theme.accent,
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 6,
      }}
    >
      {/* ⭐ Shimmer Layer */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "100%",
          backgroundColor: shimmerColor,
          opacity: 0.25,
        }}
      />

      {/* ⭐ Title Row */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 26 }}>💷</Text>

        <Text style={{ color: theme.accent, fontSize: 20, fontWeight: "800" }}>
          Buyer Affordability
        </Text>

        <View
          style={{
            backgroundColor: theme.accent,
            paddingVertical: 3,
            paddingHorizontal: 10,
            borderRadius: theme.radius.md,
            marginLeft: "auto",
          }}
        >
          <Text
            style={{
              color: theme.background,
              fontWeight: "800",
              fontSize: 12,
            }}
          >
            AI
          </Text>
        </View>
      </View>

      {/* ⭐ Divider */}
      <View
        style={{
          height: 1,
          backgroundColor: theme.cardElevated,
          opacity: 0.4,
          marginVertical: 10,
        }}
      />

      {/* ⭐ Original content (fully preserved) */}
      <Text style={{ color: theme.white, marginTop: 10, fontSize: 16 }}>
        Affordability Score: {score}/100
      </Text>

      <Text style={{ color: theme.secondary, fontSize: 16 }}>
        Match Band: {band}
      </Text>

      <Text style={{ color: theme.white, marginTop: 10 }}>
        Recommended Deposit: £{recommendedDeposit}
      </Text>

      <Text style={{ color: theme.muted, marginTop: 6 }}>
        Higher score = easier approval and stronger deal closing probability.
      </Text>

      {/* ⭐ Gradient Underline */}
      <View
        style={{
          height: 3,
          marginTop: 14,
          borderRadius: 3,
          backgroundColor: theme.goldSoftGlow,
          opacity: 0.55,
        }}
      />
    </View>
  );
}
