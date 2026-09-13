import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface StockStrategyNode {
  region: string;
  ratio: number;
  strategy: string;
  economicsImpact: {
    globalInflation: number;
    shippingCostIndex: number;
    commodityPrices: number;
    energyCost: number;
  };
}

interface Props {
  data: StockStrategyNode[];
}

export const CrossCountryStockStrategyScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🚚 Cross‑Country Stock Strategy</Text>

      {data.map((node, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.region}>{node.region}</Text>

          <Text style={styles.label}>
            Ratio: {node.ratio.toFixed(2)}
          </Text>

          <Text style={styles.sectionTitle}>Strategy</Text>
          <Text style={styles.strategy}>{node.strategy}</Text>

          <Text style={styles.sectionTitle}>Economics Impact</Text>
          <Text style={styles.label}>
            Inflation: {node.economicsImpact.globalInflation}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  strategy: {
    fontSize: 16,
    marginBottom: 10,
    fontStyle: "italic",
  },
});

