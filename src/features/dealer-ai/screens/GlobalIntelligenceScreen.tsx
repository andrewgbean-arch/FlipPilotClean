import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { GlobalIntelModel } from "../models/GlobalAIModels";

interface Props {
  data: GlobalIntelModel[];
}

export const GlobalIntelligenceScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🌍 Global Intelligence Dashboard</Text>

      {data.map((region, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.region}>{region.region}</Text>

          <Text style={styles.label}>Total Leads: {region.totalLeads}</Text>
          <Text style={styles.label}>
            Avg Flip Score: {region.avgFlipScore.toFixed(1)}
          </Text>

          <Text style={styles.label}>
            Pressure: {region.pressure.toFixed(1)}
          </Text>

          <Text
            style={[
              styles.stability,
              region.stability === "High Stress"
                ? styles.high
                : region.stability === "Moderate Stress"
                ? styles.medium
                : styles.low,
            ]}
          >
            {region.stability}
          </Text>

          <View style={styles.econBox}>
            <Text style={styles.econTitle}>Economics Impact</Text>
            <Text style={styles.econLabel}>
              Inflation: {region.economicsImpact.globalInflation}
            </Text>
            <Text style={styles.econLabel}>
              Shipping Index: {region.economicsImpact.shippingCostIndex}
            </Text>
            <Text style={styles.econLabel}>
              Commodity Prices: {region.economicsImpact.commodityPrices}
            </Text>
            <Text style={styles.econLabel}>
              Energy Cost: {region.economicsImpact.energyCost}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 3,
  },
  region: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    marginBottom: 4,
  },
  stability: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 10,
  },
  high: { color: "red" },
  medium: { color: "orange" },
  low: { color: "green" },
  econBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  econTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },
  econLabel: {
    fontSize: 15,
    marginBottom: 2,
  },
});
