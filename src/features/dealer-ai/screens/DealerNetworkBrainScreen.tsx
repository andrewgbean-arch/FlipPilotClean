import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface RegionPerformance {
  region: string;
  totalLeads: number;
  avgFlipScore: number;
  pressure: number;
  stability: string;
  economicsImpact: {
    globalInflation: number;
    shippingCostIndex: number;
    commodityPrices: number;
    energyCost: number;
  };
}

interface Props {
  data: RegionPerformance[];
}

export const DealerNetworkBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🏪 Dealer Network Brain</Text>

      {data.map((region, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.regionName}>{region.region}</Text>

          <Text style={styles.label}>Total Leads: {region.totalLeads}</Text>
          <Text style={styles.label}>Avg Flip Score: {region.avgFlipScore}</Text>
          <Text style={styles.label}>Pressure: {region.pressure}</Text>
          <Text style={styles.label}>Stability: {region.stability}</Text>

          <Text style={styles.sectionTitle}>Economics Impact</Text>
          <Text style={styles.label}>
            Inflation: {region.economicsImpact.globalInflation}
          </Text>
          <Text style={styles.label}>
            Shipping Cost Index: {region.economicsImpact.shippingCostIndex}
          </Text>
          <Text style={styles.label}>
            Commodity Prices: {region.economicsImpact.commodityPrices}
          </Text>
          <Text style={styles.label}>
            Energy Cost: {region.economicsImpact.energyCost}
          </Text>
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
  regionName: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  label: { fontSize: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 12 },
});

