import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface VehicleInvestmentNode {
  vin: string;
  investmentScore: number;
  appreciationPotential: number;
  valueStability: number;
  riskAdjustedROI: number;
  marketTrend: number;
  demandMomentum: number;
  supplyPressure: number;
  investmentBand: string;
  investmentAdjustment: number;
  strategy: string;
  recommendation: string;
}

interface Props {
  data: VehicleInvestmentNode[];
}

export const VehicleInvestmentBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📈 Vehicle Investment Brain</Text>

      {data.map((node, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.vin}>VIN: {node.vin}</Text>

          <Text style={styles.label}>
            Investment Score: {node.investmentScore.toFixed(1)}
          </Text>

          <Text style={styles.label}>
            Appreciation Potential: {node.appreciationPotential.toFixed(1)}
          </Text>

          <Text style={styles.label}>
            Value Stability: {node.valueStability.toFixed(1)}
          </Text>

          <Text style={styles.label}>
            Risk‑Adjusted ROI: £{node.riskAdjustedROI.toLocaleString()}
          </Text>

          <Text style={styles.label}>
            Market Trend Alignment: {node.marketTrend.toFixed(1)}
          </Text>

          <Text style={styles.label}>
            Demand Momentum: {node.demandMomentum.toFixed(1)}
          </Text>

          <Text style={styles.label}>
            Supply Pressure: {node.supplyPressure.toFixed(1)}
          </Text>

          <Text style={styles.sectionTitle}>Investment Band</Text>
          <Text
            style={[
              styles.band,
              node.investmentBand === "HIGH"
                ? styles.high
                : node.investmentBand === "MEDIUM"
                ? styles.medium
                : styles.low,
            ]}
          >
            {node.investmentBand}
          </Text>

          <Text style={styles.label}>
            Investment Adjustment: £{node.investmentAdjustment.toLocaleString()}
          </Text>

          <Text style={styles.label}>Strategy: {node.strategy}</Text>

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
