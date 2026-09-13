import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface WorkforceNode {
  name: string;
  role: string;
  performance: number;
  productivity: number;
  efficiency: number;
  leadConversion: number;
  salesConversion: number;
  riskContribution: number;
  profitContribution: number;
  workload: number;
  workforceBand: string;
  workforceAdjustment: number;
  recommendation: string;
}

interface Props {
  data: WorkforceNode[];
}

export const DealerWorkforceBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>👥 Dealer Workforce Brain</Text>

      {data.map((staff, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.name}>{staff.name}</Text>
          <Text style={styles.role}>{staff.role}</Text>

          <Text style={styles.label}>Performance Score: {staff.performance.toFixed(1)}</Text>
          <Text style={styles.label}>Productivity: {staff.productivity.toFixed(1)}</Text>
          <Text style={styles.label}>Efficiency: {staff.efficiency.toFixed(1)}</Text>

          <Text style={styles.label}>Lead Conversion: {staff.leadConversion.toFixed(1)}%</Text>
          <Text style={styles.label}>Sales Conversion: {staff.salesConversion.toFixed(1)}%</Text>

          <Text style={styles.label}>Risk Contribution: {staff.riskContribution.toFixed(1)}</Text>
          <Text style={styles.label}>Profit Contribution: £{staff.profitContribution}</Text>

          <Text style={styles.label}>Workload Level: {staff.workload.toFixed(1)}</Text>

          <Text
            style={[
              styles.band,
              staff.workforceBand === "HIGH"
                ? styles.high
                : staff.workforceBand === "MEDIUM"
                ? styles.medium
                : styles.low,
            ]}
          >
            {staff.workforceBand}
          </Text>

          <Text style={styles.label}>
            Workforce Adjustment: £{staff.workforceAdjustment.toLocaleString()}
          </Text>

          <Text style={styles.recommendation}>{staff.recommendation}</Text>
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
  name: { fontSize: 20, fontWeight: "bold" },
  role: { fontSize: 16, color: "#666", marginBottom: 10 },
  label: { fontSize: 16, marginBottom: 4 },
  band: { fontSize: 20, fontWeight: "bold", marginVertical: 10 },
  high: { color: "#4cd964" },
  medium: { color: "#ffcc00" },
  low: { color: "#ff3b30" },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
