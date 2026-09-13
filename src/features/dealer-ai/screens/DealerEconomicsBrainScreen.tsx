import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface DealerEconomicsNode {
  efficiency: number;
  costStructure: number;
  revenueStrength: number;
  marginStrength: number;
  stockEconomics: number;
  labourEconomics: number;
  leadEconomics: number;
  stability: number;
  economicsBand: string;
  economicsAdjustment: number;
  recommendation: string;
}

interface Props {
  data: DealerEconomicsNode;
}

export const DealerEconomicsBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📈 Dealer Economics Brain</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Economic Efficiency: {data.efficiency.toFixed(1)}</Text>
        <Text style={styles.label}>Cost Structure Score: {data.costStructure.toFixed(1)}</Text>
        <Text style={styles.label}>Revenue Strength: {data.revenueStrength.toFixed(1)}</Text>
        <Text style={styles.label}>Margin Strength: {data.marginStrength.toFixed(1)}</Text>
        <Text style={styles.label}>Stock Economics: {data.stockEconomics.toFixed(1)}</Text>
        <Text style={styles.label}>Labour Economics: {data.labourEconomics.toFixed(1)}</Text>
        <Text style={styles.label}>Lead Economics: {data.leadEconomics.toFixed(1)}</Text>

        <Text style={styles.label}>Economic Stability: {data.stability.toFixed(1)}</Text>

        <Text
          style={[
            styles.band,
            data.economicsBand === "HIGH"
              ? styles.high
              : data.economicsBand === "MEDIUM"
              ? styles.medium
              : styles.low,
          ]}
        >
          {data.economicsBand}
        </Text>

        <Text style={styles.label}>
          Economics Adjustment: £{data.economicsAdjustment.toLocaleString()}
        </Text>

        <Text style={styles.recommendation}>{data.recommendation}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 26, fontWeight: "bold", marginBottom: 20 },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 3,
  },
  label: { fontSize: 16, marginBottom: 6 },
  band: { fontSize: 22, fontWeight: "bold", marginVertical: 12 },
  high: { color: "#4cd964" },
  medium: { color: "#ffcc00" },
  low: { color: "#ff3b30" },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
