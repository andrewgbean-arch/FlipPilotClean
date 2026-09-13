import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface VehicleHistoryNode {
  vin: string;
  owners: number;
  serviceEvents: number;
  damageEvents: number;
  insuranceClaims: number;
  mileageIntegrity: number;
  ownershipScore: number;
  serviceScore: number;
  damageScore: number;
  claimScore: number;
  historyScore: number;
  riskBand: string;
  historyAdjustment: number;
  flipPotential: string;
  recommendation: string;
}

interface Props {
  data: VehicleHistoryNode[];
}

export const VehicleHistoryBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📜 Vehicle History Brain</Text>

      {data.map((node, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.vin}>VIN: {node.vin}</Text>

          <Text style={styles.label}>Owners: {node.owners}</Text>
          <Text style={styles.label}>Service Events: {node.serviceEvents}</Text>
          <Text style={styles.label}>Damage Events: {node.damageEvents}</Text>
          <Text style={styles.label}>Insurance Claims: {node.insuranceClaims}</Text>
          <Text style={styles.label}>
            Mileage Integrity: {node.mileageIntegrity.toFixed(1)} / 10
          </Text>

          <Text style={styles.sectionTitle}>History Scores</Text>
          <Text style={styles.label}>Ownership Score: {node.ownershipScore.toFixed(1)}</Text>
          <Text style={styles.label}>Service Score: {node.serviceScore.toFixed(1)}</Text>
          <Text style={styles.label}>Damage Score: {node.damageScore.toFixed(1)}</Text>
          <Text style={styles.label}>Claim Score: {node.claimScore.toFixed(1)}</Text>

          <Text style={styles.sectionTitle}>Overall History Score</Text>
          <Text style={styles.score}>{node.historyScore.toFixed(1)}</Text>

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
            History Adjustment: £{node.historyAdjustment.toLocaleString()}
          </Text>

          <Text style={styles.recommendation}>Flip Potential: {node.flipPotential}</Text>
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
