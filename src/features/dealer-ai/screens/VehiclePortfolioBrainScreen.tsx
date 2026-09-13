import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface PortfolioNode {
  totalVehicles: number;
  avgRisk: number;
  avgReliability: number;
  avgProfit: number;
  avgInvestmentScore: number;
  depreciation12: number;
  volatility: number;
  diversification: number;
  portfolioBand: string;
  recommendation: string;
}

interface Props {
  data: PortfolioNode;
}

export const VehiclePortfolioBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📊 Vehicle Portfolio Brain</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Total Vehicles: {data.totalVehicles}</Text>
        <Text style={styles.label}>Average Risk: {data.avgRisk.toFixed(1)}</Text>
        <Text style={styles.label}>Average Reliability: {data.avgReliability.toFixed(1)}</Text>
        <Text style={styles.label}>Average Profit: £{data.avgProfit.toLocaleString()}</Text>
        <Text style={styles.label}>Investment Score: {data.avgInvestmentScore.toFixed(1)}</Text>
        <Text style={styles.label}>12‑Month Depreciation: £{data.depreciation12.toLocaleString()}</Text>
        <Text style={styles.label}>Volatility: {data.volatility.toFixed(1)}</Text>
        <Text style={styles.label}>Diversification: {data.diversification.toFixed(1)}</Text>

        <Text
          style={[
            styles.band,
            data.portfolioBand === "HIGH"
              ? styles.high
              : data.portfolioBand === "MEDIUM"
              ? styles.medium
              : styles.low,
          ]}
        >
          {data.portfolioBand}
        </Text>

        <Text style={styles.recommendation}>{data.recommendation}</Text>
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
  label: { fontSize: 16, marginBottom: 6 },
  band: { fontSize: 22, fontWeight: "bold", marginVertical: 12 },
  high: { color: "#4cd964" },
  medium: { color: "#ffcc00" },
  low: { color: "#ff3b30" },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
