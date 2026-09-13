import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface GlobalStressNode {
  avgPressure: number;
  supplyStressCount: number;
  globalStress: number;
  band: string;
  recommendation: string;
}

interface Props {
  data: GlobalStressNode;
}

export const GlobalMarketStressScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🌐 Global Market Stress Engine</Text>

      <View style={styles.card}>
        <Text style={styles.label}>
          Avg Pressure: {data.avgPressure.toFixed(1)}
        </Text>

        <Text style={styles.label}>
          Supply Stress Count: {data.supplyStressCount}
        </Text>

        <Text style={styles.label}>
          Global Stress Score: {data.globalStress.toFixed(1)} / 100
        </Text>

        <Text
          style={[
            styles.band,
            data.band === "HIGH"
              ? styles.high
              : data.band === "MEDIUM"
              ? styles.medium
              : styles.low,
          ]}
        >
          {data.band}
        </Text>

        <Text style={styles.sectionTitle}>Recommendation</Text>
        <Text style={styles.recommendation}>{data.recommendation}</Text>
      </View>
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
  label: {
    fontSize: 16,
    marginBottom: 4,
  },
  band: {
    fontSize: 20,
    fontWeight: "bold",
    marginVertical: 10,
  },
  high: { color: "#ff3b30" },
  medium: { color: "#ffcc00" },
  low: { color: "#4cd964" },
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
