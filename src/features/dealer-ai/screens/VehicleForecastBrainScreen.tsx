import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface VehicleForecastNode {
  vin: string;
  dep6: number;
  dep12: number;
  dep24: number;
  futureReliability: number;
  futureRisk: number;
  futureMaintenance: number;
  futureDemand: number;
  futureProfit: number;
  forecastBand: string;
  recommendation: string;
}

interface Props {
  data: VehicleForecastNode[];
}

export const VehicleForecastBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔮 Vehicle Forecast Brain</Text>

      {data.map((node, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.vin}>VIN: {node.vin}</Text>

          <Text style={styles.label}>6‑Month Depreciation: £{node.dep6.toLocaleString()}</Text>
          <Text style={styles.label}>12‑Month Depreciation: £{node.dep12.toLocaleString()}</Text>
          <Text style={styles.label}>24‑Month Depreciation: £{node.dep24.toLocaleString()}</Text>

          <Text style={styles.label}>Future Reliability: {node.futureReliability.toFixed(1)}</Text>
          <Text style={styles.label}>Future Risk: {node.futureRisk.toFixed(1)}</Text>
          <Text style={styles.label}>Future Maintenance: £{node.futureMaintenance.toLocaleString()}</Text>
          <Text style={styles.label}>Future Demand: {node.futureDemand.toFixed(1)}</Text>

          <Text style={styles.sectionTitle}>Future Profit Potential</Text>
          <Text style={styles.score}>£{node.futureProfit.toLocaleString()}</Text>

          <Text
            style={[
              styles.band,
              node.forecastBand === "HIGH"
                ? styles.high
                : node.forecastBand === "MEDIUM"
                ? styles.medium
                : styles.low,
            ]}
          >
            {node.forecastBand}
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
