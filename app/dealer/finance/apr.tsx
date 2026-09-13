import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useDealerAI } from "../../../src/features/dealer-ai/DealerAIContext";

import DealerNeonHeader from "../../../src/components/dealer/DealerNeonHeader";
import SupernovaCard from "../../../src/components/dealer/SupernovaCard";

export default function APRSensitivityScreen() {
  const { vehicle: v, buyer: b } = useLocalSearchParams();
  const vehicle = typeof v === "string" ? JSON.parse(v) : v;
  const buyer = typeof b === "string" ? JSON.parse(b) : b;

  const ai = useDealerAI();
  const apr = ai.aprSensitivity(vehicle, buyer);

  return (
    <ScrollView style={styles.container}>
      {/* FIX: Add required props */}
      <DealerNeonHeader 
        title="APR Sensitivity"
        subtitle="Finance Intelligence Model"
      />

      {/* FIX: Add required props */}
      <SupernovaCard 
        title="APR Sensitivity Model"
        glow
        style={styles.card}
      >
        <Text style={styles.value}>{apr.apr}% APR</Text>
        <Text style={styles.sub}>Base APR: {apr.baseAPR}%</Text>
        <Text style={styles.sub}>Credit Impact: +{apr.creditImpact}%</Text>
        <Text style={styles.sub}>Fraud Impact: +{apr.fraudImpact}%</Text>
        <Text style={styles.sub}>Age Impact: +{apr.ageImpact}%</Text>

        <Text style={styles.desc}>{apr.message}</Text>
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
