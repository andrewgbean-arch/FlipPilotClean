import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useDealerAI } from "../../../src/features/dealer-ai/DealerAIContext";

import DealerNeonHeader from "../../../src/components/dealer/DealerNeonHeader";
import SupernovaCard from "../../../src/components/dealer/SupernovaCard";

export default function ComplianceScreen() {
  const { vehicle: v, buyer: b } = useLocalSearchParams();
  const vehicle = typeof v === "string" ? JSON.parse(v) : v;
  const buyer = typeof b === "string" ? JSON.parse(b) : b;

  const ai = useDealerAI();
  const compliance = ai.financeComplianceCheck(buyer, vehicle);

  return (
    <ScrollView style={styles.container}>
      {/* FIX: Add required props */}
      <DealerNeonHeader 
        title="FCA Compliance"
        subtitle="Regulatory Risk & Compliance Checks"
      />

      {/* FIX: Add required props */}
      <SupernovaCard 
        title="FCA Compliance Check"
        glow
        style={styles.card}
      >
        {compliance.map((c, i) => (
          <Text key={i} style={styles.warning}>
            ⚠️ {c}
          </Text>
        ))}
      </SupernovaCard>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A1128", paddingHorizontal: 16 },
  card: { marginTop: 20 },
  warning: { fontSize: 15, color: "#ff6666", marginBottom: 4 },
});
