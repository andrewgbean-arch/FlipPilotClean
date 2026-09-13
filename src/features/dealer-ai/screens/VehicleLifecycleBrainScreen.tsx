import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface VehicleLifecycleNode {
  vin: string;
  remainingLifeYears: number;
  failureWindowMonths: number;
  majorFailureProb: number;
  valueCollapseMonths: number;
  demandCollapseMonths: number;
  riskTrajectory: number;
  maintenanceTrajectory: number;
  lifecycleBand: string;
  lifecycleAdjustment: number;
  optimalFlipWindow: string;
  optimalDisposalWindow: string;
  recommendation: string;
}

interface Props {
  data: VehicleLifecycleNode[];
}

export const VehicleLifecycleBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>♾️ Vehicle Lifecycle Brain</Text>

      {data.map((node, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.vin}>VIN: {node.vin}</Text>

          <Text style={styles.label}>
            Remaining Life: {node.remainingLifeYears.toFixed(1)} years
          </Text>

          <Text style={styles.label}>
            Failure Window: {node.failureWindowMonths} months
          </Text>

          <Text style={styles.label}>
            Major Failure Probability: {(node.majorFailureProb * 100).toFixed(1)}%
          </Text>

          <Text style={styles.label}>
            Value Collapse: {node.valueCollapseMonths} months
          </Text>

          <Text style={styles.label}>
            Demand Collapse: {node.demandCollapseMonths} months
          </Text>

          <Text style={styles.label}>
            Risk Trajectory: {node.riskTrajectory.toFixed(1)}
          </Text>

          <Text style={styles.label}>
            Maintenance Trajectory: £{node.maintenanceTrajectory.toLocaleString()}
          </Text>

          <Text style={styles.sectionTitle}>Lifecycle Band</Text>
          <Text
            style={[
              styles.band,
              node.lifecycleBand === "HIGH"
                ? styles.high
                : node.lifecycleBand === "MEDIUM"
                ? styles.medium
                : styles.low,
            ]}
          >
            {node.lifecycleBand}
          </Text>

          <Text style={styles.label}>
            Lifecycle Adjustment: £{node.lifecycleAdjustment.toLocaleString()}
          </Text>

          <Text style={styles.label}>
            Optimal Flip Window: {node.optimalFlipWindow}
          </Text>

          <Text style={styles.label}>
            Optimal Disposal Window: {node.optimalDisposalWindow}
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
  band: { fontSize: 20, fontWeight: "bold", marginVertical: 10 },
  high: { color: "#4cd964" },
  medium: { color: "#ffcc00" },
  low: { color: "#ff3b30" },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
