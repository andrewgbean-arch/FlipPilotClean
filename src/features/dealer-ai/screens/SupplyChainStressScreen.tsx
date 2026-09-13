import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface SupplyChainNode {
  oem: string;
  globalDemand: number;
  supplyCapacity: number;
  supplyStress: string;
  economicsImpact: {
    inflation: number;
    shippingCostIndex: number;
    commodityPrices: number;
    energyCost: number;
  };
  recommendation: string;
}

interface Props {
  data: SupplyChainNode[];
}

export const SupplyChainStressScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🌐 Supply Chain Stress Map</Text>

      {data.map((node, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.oem}>{node.oem}</Text>

          <Text style={styles.label}>
            Global Demand: {node.globalDemand.toFixed(1)}
          </Text>

          <Text style={styles.label}>
            Supply Capacity: {node.supplyCapacity.toFixed(1)}
          </Text>

          <Text style={styles.label}>
            Stress Level: {node.supplyStress}
          </Text>

          <Text style={styles.sectionTitle}>Economics Impact</Text>

          <Text style={styles.label}>
            Inflation: {node.economicsImpact.inflation}
          </Text>
          <Text style={styles.label}>
            Shipping Cost Index: {node.economicsImpact.shippingCostIndex}
          </Text>
          <Text style={styles.label}>
            Commodity Prices: {node.economicsImpact.commodityPrices}
          </Text>
          <Text style={styles.label}>
            Energy Cost: {node.economicsImpact.energyCost}
          </Text>

          <Text style={styles.sectionTitle}>Recommendation</Text>
          <Text style={styles.recommendation}>{node.recommendation}</Text>
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
  oem: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  recommendation: {
    fontSize: 16,
    fontStyle: "italic",
    color: "#444",
  },
});

