import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface FlipProfitNode {
  vin: string;
  trueCost: number;
  reconCost: number;
  recommendedRetail: number;
  recommendedTrade: number;
  demandAdj: number;
  supplyAdj: number;
  marketAdj: number;
  netProfit: number;
  profitBand: string;
  viability: string;
  recommendation: string;
}

interface Props {
  data: FlipProfitNode[];
}

export const FlipProfitBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>💰 Flip Profit Brain</Text>

      {data.map((node, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.vin}>VIN: {node.vin}</Text>

          <Text style={styles.label}>
            True Cost Basis: £{node.trueCost.toLocaleString()}
          </Text>

          <Text style={styles.label}>
            Reconditioning Cost: £{node.reconCost.toLocaleString()}
          </Text>

          <Text style={styles.label}>
            Recommended Retail: £{node.recommendedRetail.toLocaleString()}
          </Text>

          <Text style={styles.label}>
            Recommended Trade: £{node.recommendedTrade.toLocaleString()}
          </Text>

          <Text style={styles.label}>
            Demand Adjustment: £{node.demandAdj.toLocaleString()}
          </Text>

          <Text style={styles.label}>
            Supply Adjustment: £{node.supplyAdj.toLocaleString()}
          </Text>

          <Text style={styles.label}>
            Market Adjustment: £{node.marketAdj.toLocaleString()}
          </Text>

          <Text style={styles.sectionTitle}>Net Profit</Text>
          <Text style={styles.score}>£{node.netProfit.toLocaleString()}</Text>

          <Text
            style={[
              styles.band,
              node.profitBand === "HIGH"
                ? styles.high
                : node.profitBand === "MEDIUM"
                ? styles.medium
                : styles.low,
            ]}
          >
            {node.profitBand}
          </Text>

          <Text style={styles.recommendation}>
            Flip Viability: {node.viability}
          </Text>

          <Text style={styles.recommendation}>{node.recommendation}</Text>
        </View>
      ))}
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
  vin: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  label: { fontSize: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 12 },
  score: { fontSize: 22, fontWeight: "bold", marginVertical: 10 },
  band: { fontSize: 20, fontWeight: "bold", marginVertical: 10 },
  high: { color: "#4cd964" },
  medium: { color: "#ffcc00" },
  low: { color: "#ff3b30" },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
