import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface PredictiveNode {
  region: string;
  demandForecast: number;
  supplyForecast: number;
  pricePressure: number;
  riskBand: string;
  recommendation: string;
}

interface Props {
  data: PredictiveNode[];
}

export const PredictiveDemandBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔮 Predictive Demand Brain</Text>

      {data.map((node, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.region}>{node.region}</Text>

          <Text style={styles.label}>
            Demand Forecast: {node.demandForecast.toFixed(1)}
          </Text>

          <Text style={styles.label}>
            Supply Forecast: {node.supplyForecast.toFixed(1)}
          </Text>

          <Text style={styles.label}>
            Price Pressure: {node.pricePressure.toFixed(1)}
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
