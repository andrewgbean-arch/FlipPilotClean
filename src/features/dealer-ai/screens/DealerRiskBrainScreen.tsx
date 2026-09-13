import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface DealerRiskNode {
  operationalRisk: number;
  financialRisk: number;
  stockRisk: number;
  staffRisk: number;
  complianceRisk: number;
  marketExposure: number;
  liquidityRisk: number;
  stability: number;
  riskBand: string;
  riskAdjustment: number;
  strategy: string;
  recommendation: string;
}

interface Props {
  data: DealerRiskNode;
}

export const DealerRiskBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>⚠️ Dealer Risk Brain</Text>

      <View style={styles.card}>
        <Text style={styles.label}>
          Operational Risk: {data.operationalRisk.toFixed(1)}
        </Text>

        <Text style={styles.label}>
          Financial Risk: {data.financialRisk.toFixed(1)}
        </Text>

        <Text style={styles.label}>
          Stock Risk: {data.stockRisk.toFixed(1)}
        </Text>

        <Text style={styles.label}>
          Staff Risk: {data.staffRisk.toFixed(1)}
        </Text>

        <Text style={styles.label}>
          Compliance Risk: {data.complianceRisk.toFixed(1)}
        </Text>

        <Text style={styles.label}>
          Market Exposure: {data.marketExposure.toFixed(1)}
        </Text>

        <Text style={styles.label}>
          Liquidity Risk: {data.liquidityRisk.toFixed(1)}
        </Text>

        <Text style={styles.label}>
          Risk Stability: {data.stability.toFixed(1)}
        </Text>

        <Text
          style={[
            styles.band,
            data.riskBand === "HIGH"
              ? styles.high
              : data.riskBand === "MEDIUM"
              ? styles.medium
              : styles.low,
          ]}
        >
          {data.riskBand}
        </Text>

        <Text style={styles.label}>
          Risk Adjustment: £{data.riskAdjustment.toLocaleString()}
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
  band: { fontSize: 22, fontWeight: "bold", marginVertical: 12 },
  high: { color: "#ff3b30" },
  medium: { color: "#ffcc00" },
  low: { color: "#4cd964" },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
