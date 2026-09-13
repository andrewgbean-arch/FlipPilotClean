import React, { useRef, useEffect } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import SupernovaCard from "./SupernovaCard";
import { useDealerAI } from "@/features/dealer-ai/DealerAIContext";

type Props = {
  vehicle: any;
  buyer: any;
};

export default function FinanceSuiteSummaryCard({ vehicle, buyer }: Props) {
  const ai = useDealerAI();

  const approval = ai.financeApprovalAI(buyer, vehicle);
  const deposit = ai.depositOptimiser(buyer, vehicle);
  const apr = ai.aprSensitivity(vehicle, buyer);
  const stress = ai.paymentStressTest(buyer, vehicle);
  const lender = ai.lenderMatch(buyer, vehicle);

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
    <SupernovaCard
      title="FinanceSuite V16 Summary"
      subtitle="AI‑Powered Finance Intelligence"
      icon="💳"
      badge="AI"
      shimmer
      gradientBar
      glow
      style={styles.card}
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

      {/* ⭐ Approval */}
      <View style={styles.row}>
        <Text style={styles.label}>Approval:</Text>
        <Text style={styles.value}>{approval}</Text>
      </View>

      {/* ⭐ Deposit */}
      <View style={styles.row}>
        <Text style={styles.label}>Deposit:</Text>
        <Text style={styles.value}>£{deposit.recommendedDeposit}</Text>
      </View>

      {/* ⭐ APR */}
      <View style={styles.row}>
        <Text style={styles.label}>APR:</Text>
        <Text style={styles.value}>{apr.apr}%</Text>
      </View>

      {/* ⭐ Stress Test */}
      <View style={styles.row}>
        <Text style={styles.label}>Stress:</Text>
        <Text style={styles.value}>
          {stress.safeZone
            ? "Safe"
            : stress.dangerZone
            ? "Danger"
            : "Moderate"}
        </Text>
      </View>

      {/* ⭐ Lender Match */}
      <View style={styles.row}>
        <Text style={styles.label}>Lender:</Text>
        <Text style={styles.value}>{lender}</Text>
      </View>
    </SupernovaCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    color: "#ccc",
  },
  value: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFD700",
  },
});
