import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface DealerStressNode {
  operational: number;
  financial: number;
  stock: number;
  staff: number;
  compliance: number;
  market: number;
  liquidity: number;
  stability: number;
  stressBand: string;
  stressAdjustment: number;
  recommendation: string;
}

interface Props {
  data: DealerStressNode;
}

export const DealerStressBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔥 Dealer Stress Brain</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Operational Stress: {data.operational.toFixed(1)}</Text>
        <Text style={styles.label}>Financial Stress: {data.financial.toFixed(1)}</Text>
        <Text style={styles.label}>Stock Stress: {data.stock.toFixed(1)}</Text>
        <Text style={styles.label}>Staff Stress: {data.staff.toFixed(1)}</Text>
        <Text style={styles.label}>Compliance Stress: {data.compliance.toFixed(1)}</Text>
        <Text style={styles.label}>Market Stress: {data.market.toFixed(1)}</Text>
        <Text style={styles.label}>Liquidity Stress: {data.liquidity.toFixed(1)}</Text>

        <Text style={styles.label}>Stability Score: {data.stability.toFixed(1)}</Text>

        <Text
          style={[
            styles.band,
            data.stressBand === "HIGH"
              ? styles.high
              : data.stressBand === "MEDIUM"
              ? styles.medium
              : styles.low,
          ]}
        >
          {data.stressBand}
        </Text>

        <Text style={styles.label}>
          Stress Adjustment: £{data.stressAdjustment.toLocaleString()}
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
  high: { color: "#ff3b30" },
  medium: { color: "#ffcc00" },
  low: { color: "#4cd964" },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
