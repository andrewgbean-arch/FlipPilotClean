import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface PricingNode {
  region: string;
  recommendedRetail: number;
  recommendedTrade: number;
  demandScore: number;
  supplyScore: number;
  marketPressure: number;
  riskBand: string;
  recommendation: string;
}

interface Props {
  data: PricingNode[];
}

export const PricingBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>💷 Pricing Brain</Text>

      {data.map((node, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.region}>{node.region}</Text>

          <Text style={styles.label}>
            Recommended Retail: £{node.recommendedRetail.toLocaleString()}
          </Text>

          <Text style={styles.label}>
            Recommended Trade: £{node.recommendedTrade.toLocaleString()}
          </Text>

          <Text style={styles.label}>
            Demand Score: {node.demandScore.toFixed(1)}
          </Text>

          <Text style={styles.label}>
            Supply Score: {node.supplyScore.toFixed(1)}
          </Text>

          <Text style={styles.label}>
            Market Pressure: {node.marketPressure.toFixed(1)}
          </Text>

          <Text
            style={[
              styles.band,
              node.riskBand === "HIGH"
                ? styles.high
                : node.riskBand === "MEDIUM"
                ? styles.medium
                : styles.low,
            ]}
          >
            {node.riskBand}
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
  region: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  label: { fontSize: 16, marginBottom: 4 },
  band: { fontSize: 20, fontWeight: "bold", marginVertical: 10 },
  high: { color: "#ff3b30" },
  medium: { color: "#ffcc00" },
  low: { color: "#4cd964" },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
