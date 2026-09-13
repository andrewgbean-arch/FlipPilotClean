import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface VehicleConditionNode {
  vin: string;
  mileage: number;
  ageYears: number;
  mechanicalScore: number;
  cosmeticScore: number;
  reliabilityScore: number;
  depreciationScore: number;
  conditionScore: number;
  riskBand: string;
  reconCost: number;
  retailAdjustment: number;
  flipPotential: string;
}

interface Props {
  data: VehicleConditionNode[];
}

export const VehicleConditionBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🚗 Vehicle Condition Brain</Text>

      {data.map((node, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.vin}>VIN: {node.vin}</Text>

          <Text style={styles.label}>Mileage: {node.mileage.toLocaleString()} miles</Text>
          <Text style={styles.label}>Age: {node.ageYears} years</Text>

          <Text style={styles.label}>Mechanical Score: {node.mechanicalScore.toFixed(1)}</Text>
          <Text style={styles.label}>Cosmetic Score: {node.cosmeticScore.toFixed(1)}</Text>
          <Text style={styles.label}>Reliability Score: {node.reliabilityScore.toFixed(1)}</Text>
          <Text style={styles.label}>Depreciation Score: {node.depreciationScore.toFixed(1)}</Text>

          <Text style={styles.sectionTitle}>Condition Score</Text>
          <Text style={styles.score}>{node.conditionScore.toFixed(1)}</Text>

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
            Reconditioning Cost: £{node.reconCost.toLocaleString()}
          </Text>

          <Text style={styles.label}>
            Retail Adjustment: £{node.retailAdjustment.toLocaleString()}
          </Text>

          <Text style={styles.recommendation}>Flip Potential: {node.flipPotential}</Text>
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
