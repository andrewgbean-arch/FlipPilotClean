import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface VehicleRiskNode {
  vin: string;
  mechanicalRisk: number;
  electricalRisk: number;
  ownershipRisk: number;
  historyRisk: number;
  marketRisk: number;
  economicRisk: number;
  combinedRisk: number;
  riskBand: string;
  riskAdjustment: number;
  flipSafety: string;
  recommendation: string;
}

interface Props {
  data: VehicleRiskNode[];
}

export const VehicleRiskBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>⚠️ Vehicle Risk Brain</Text>

      {data.map((node, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.vin}>VIN: {node.vin}</Text>

          <Text style={styles.label}>Mechanical Risk: {node.mechanicalRisk.toFixed(1)}</Text>
          <Text style={styles.label}>Electrical Risk: {node.electricalRisk.toFixed(1)}</Text>
          <Text style={styles.label}>Ownership Risk: {node.ownershipRisk.toFixed(1)}</Text>
          <Text style={styles.label}>History Risk: {node.historyRisk.toFixed(1)}</Text>
          <Text style={styles.label}>Market Risk: {node.marketRisk.toFixed(1)}</Text>
          <Text style={styles.label}>Economic Risk: {node.economicRisk.toFixed(1)}</Text>

          <Text style={styles.sectionTitle}>Combined Risk Score</Text>
          <Text style={styles.score}>{node.combinedRisk.toFixed(1)}</Text>

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

          <Text style={styles.label}>
            Risk Adjustment: £{node.riskAdjustment.toLocaleString()}
          </Text>

          <Text style={styles.recommendation}>Flip Safety: {node.flipSafety}</Text>
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
  high: { color: "#ff3b30" },
  medium: { color: "#ffcc00" },
  low: { color: "#4cd964" },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
