import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface DealerProfitabilityNode {
  grossProfit: number;
  netProfit: number;
  profitPerVehicle: number;
  departmentProfit: {
    sales: number;
    service: number;
    finance: number;
    parts: number;
  };
  staffPerformance: number;
  efficiency: number;
  leakage: number;
  stability: number;
  profitBand: string;
  profitAdjustment: number;
  strategy: string;
  recommendation: string;
}

interface Props {
  data: DealerProfitabilityNode;
}

export const DealerProfitabilityBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>💼 Dealer Profitability Brain</Text>

      <View style={styles.card}>
        <Text style={styles.label}>
          Gross Profit: £{data.grossProfit.toLocaleString()}
        </Text>

        <Text style={styles.label}>
          Net Profit: £{data.netProfit.toLocaleString()}
        </Text>

        <Text style={styles.label}>
          Profit Per Vehicle: £{data.profitPerVehicle.toLocaleString()}
        </Text>

        <Text style={styles.sectionTitle}>Department Profit Breakdown</Text>
        <Text style={styles.label}>Sales: £{data.departmentProfit.sales.toLocaleString()}</Text>
        <Text style={styles.label}>Service: £{data.departmentProfit.service.toLocaleString()}</Text>
        <Text style={styles.label}>Finance: £{data.departmentProfit.finance.toLocaleString()}</Text>
        <Text style={styles.label}>Parts: £{data.departmentProfit.parts.toLocaleString()}</Text>

        <Text style={styles.label}>
          Staff Performance Score: {data.staffPerformance.toFixed(1)}
        </Text>

        <Text style={styles.label}>
          Operational Efficiency: {data.efficiency.toFixed(1)}
        </Text>

        <Text style={styles.label}>
          Cost Leakage: {data.leakage.toFixed(1)}
        </Text>

        <Text style={styles.label}>
          Profit Stability: {data.stability.toFixed(1)}
        </Text>

        <Text
          style={[
            styles.band,
            data.profitBand === "HIGH"
              ? styles.high
              : data.profitBand === "MEDIUM"
              ? styles.medium
              : styles.low,
          ]}
        >
          {data.profitBand}
        </Text>

        <Text style={styles.label}>
          Profit Adjustment: £{data.profitAdjustment.toLocaleString()}
        </Text>

        <Text style={styles.label}>Strategy: {data.strategy}</Text>

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
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 12 },
  band: { fontSize: 22, fontWeight: "bold", marginVertical: 12 },
  high: { color: "#4cd964" },
  medium: { color: "#ffcc00" },
  low: { color: "#ff3b30" },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
