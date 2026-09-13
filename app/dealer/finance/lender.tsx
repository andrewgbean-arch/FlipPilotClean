import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useDealerAI } from "../../../src/features/dealer-ai/DealerAIContext";

import DealerNeonHeader from "../../../src/components/dealer/DealerNeonHeader";
import SupernovaCard from "../../../src/components/dealer/SupernovaCard";

export default function LenderMatchScreen() {
  const { vehicle: v, buyer: b } = useLocalSearchParams();
  const vehicle = typeof v === "string" ? JSON.parse(v) : v;
  const buyer = typeof b === "string" ? JSON.parse(b) : b;

  const ai = useDealerAI();
  const lender = ai.lenderMatch(buyer, vehicle);

  return (
    <ScrollView style={styles.container}>
      {/* FIX: Add required props */}
      <DealerNeonHeader 
        title="Lender Match Engine"
        subtitle="AI‑Powered Lender Selection"
      />

      {/* FIX: Add required props */}
      <SupernovaCard 
        title="Lender Match Engine"
        glow
        style={styles.card}
      >
        <Text style={styles.value}>{lender}</Text>
        <Text style={styles.desc}>
          Best lender match based on buyer + vehicle profile.
        </Text>
      </SupernovaCard>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A1128", paddingHorizontal: 16 },
  card: { marginTop: 20 },
  value: { fontSize: 26, fontWeight: "bold", color: "#FFD700", marginBottom: 6 },
  desc: { fontSize: 14, color: "#aaa", marginTop: 8 },
});
