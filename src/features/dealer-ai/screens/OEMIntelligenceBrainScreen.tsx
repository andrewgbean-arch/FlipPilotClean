import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface OEMIntel {
  oem: string;
  productionCost: number;
  wholesalePrice: number;
  avgDeliveryTimeDays: number;
  globalCapacity: number;
  supplyStress: string;
  globalDemand: number;
  economicsImpact: {
    inflation: number;
    shippingCostIndex: number;
    commodityPrices: number;
    energyCost: number;
  };
  recommendation: string;
}

interface Props {
  data: OEMIntel[];
}

export const OEMIntelligenceBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🏭 OEM Intelligence Brain</Text>

      {data.map((oem, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.oemName}>{oem.oem}</Text>

          <Text style={styles.label}>
            Production Cost: £{oem.productionCost.toLocaleString()}
          </Text>

          <Text style={styles.label}>
            Wholesale Price: £{oem.wholesalePrice.toLocaleString()}
          </Text>

          <Text style={styles.label}>
            Avg Delivery Time: {oem.avgDeliveryTimeDays} days
          </Text>

          <Text style={styles.label}>
            Global Capacity: {(oem.globalCapacity * 100).toFixed(0)}%
          </Text>

          <Text style={styles.label}>Supply Stress: {oem.supplyStress}</Text>
          <Text style={styles.label}>Global Demand: {oem.globalDemand}</Text>

          <Text style={styles.sectionTitle}>Economics Impact</Text>
          <Text style={styles.label}>
            Inflation: {oem.economicsImpact.inflation}
          </Text>
          <Text style={styles.label}>
            Shipping Cost Index: {oem.economicsImpact.shippingCostIndex}
          </Text>
          <Text style={styles.label}>
            Commodity Prices: {oem.economicsImpact.commodityPrices}
          </Text>
          <Text style={styles.label}>
            Energy Cost: {oem.economicsImpact.energyCost}
          </Text>

          <Text style={styles.sectionTitle}>Recommendation</Text>
          <Text style={styles.recommendation}>{oem.recommendation}</Text>
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
  oemName: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  label: { fontSize: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 12 },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
