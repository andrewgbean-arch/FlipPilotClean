import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useDealerAI } from "../../../src/features/dealer-ai/DealerAIContext";

import DealerNeonHeader from "../../../src/components/dealer/DealerNeonHeader";
import SupernovaCard from "../../../src/components/dealer/SupernovaCard";

export default function StressTestScreen() {
  const { vehicle: v, buyer: b } = useLocalSearchParams();
  const vehicle = typeof v === "string" ? JSON.parse(v) : v;
  const buyer = typeof b === "string" ? JSON.parse(b) : b;

  const ai = useDealerAI();
  const stress = ai.paymentStressTest(buyer, vehicle);

  return (
    <ScrollView style={styles.container}>
      {/* FIX: Add required props */}
      <DealerNeonHeader 
        title="Payment Stress Test"
        subtitle="AI‑Powered Affordability Analysis"
      />

      {/* FIX: Add required props */}
      <SupernovaCard 
        title="Payment Stress Test"
        glow
        style={styles.card}
      >
        <Text style={styles.value}>£{stress.monthly}/mo</Text>
        <Text style={styles.sub}>Affordability Score: {stress.affordability}</Text>

        <Text style={styles.sub}>
          Status:{" "}
          {stress.safeZone
            ? "Safe Zone"
            : stress.dangerZone
            ? "Danger Zone"
            : "Moderate Risk"}
        </Text>

        <Text style={styles.desc}>{stress.message}</Text>
      </SupernovaCard>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A1128", paddingHorizontal: 16 },
  card: { marginTop: 20 },
  value: { fontSize: 26, fontWeight: "bold", color: "#FFD700", marginBottom: 6 },
  sub: { fontSize: 16, color: "#ccc", marginBottom: 4 },
  desc: { fontSize: 14, color: "#aaa", marginTop: 8 },
});
