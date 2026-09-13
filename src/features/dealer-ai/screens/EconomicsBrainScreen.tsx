import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface EconomicsBrain {
  globalInflation: number;
  shippingCostIndex: number;
  commodityPrices: number;
  energyCost: number;
}

interface Props {
  data: EconomicsBrain;
}

export const EconomicsBrainScreen: React.FC<Props> = ({ data }) => {
  const pressureScore =
    data.globalInflation * 0.4 +
    data.shippingCostIndex * 0.3 +
    data.commodityPrices * 0.2 +
    data.energyCost * 0.1;

  const band =
    pressureScore > 3.5 ? "HIGH" : pressureScore > 2 ? "MEDIUM" : "LOW";

  const recommendation =
    band === "HIGH"
      ? "Reduce exposure, tighten purchasing cycles, and avoid long‑term commitments."
      : band === "MEDIUM"
      ? "Monitor trends closely and adjust stock flow gradually."
      : "Conditions stable — safe to expand inventory and marketing.";

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📊 Economics Brain</Text>

      <View style={styles.card}>
        <Text style={styles.label}>
          Global Inflation: {data.globalInflation.toFixed(2)}
        </Text>
        <Text style={styles.label}>
          Shipping Cost Index: {data.shippingCostIndex.toFixed(2)}
        </Text>
        <Text style={styles.label}>
          Commodity Prices: {data.commodityPrices.toFixed(2)}
        </Text>
        <Text style={styles.label}>
          Energy Cost: {data.energyCost.toFixed(2)}
        </Text>

        <Text style={styles.sectionTitle}>Economic Pressure Score</Text>
        <Text style={styles.score}>{pressureScore.toFixed(2)}</Text>

        <Text
          style={[
            styles.band,
            band === "HIGH"
              ? styles.high
              : band === "MEDIUM"
              ? styles.medium
              : styles.low,
          ]}
        >
          {band}
        </Text>

        <Text style={styles.sectionTitle}>Recommendation</Text>
        <Text style={styles.recommendation}>{recommendation}</Text>
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
  label: { fontSize: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 12 },
  score: { fontSize: 22, fontWeight: "bold", marginVertical: 10 },
  band: { fontSize: 20, fontWeight: "bold", marginVertical: 10 },
  high: { color: "#ff3b30" },
  medium: { color: "#ffcc00" },
  low: { color: "#4cd964" },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
