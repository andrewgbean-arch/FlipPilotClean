import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface DealerCultureNode {
  cohesion: number;
  leadership: number;
  alignment: number;
  communication: number;
  motivation: number;
  conflict: number;
  trust: number;
  stability: number;
  cultureBand: string;
  cultureAdjustment: number;
  recommendation: string;
}

interface Props {
  data: DealerCultureNode;
}

export const DealerCultureBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🏛 Dealer Culture Brain</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Cohesion Score: {data.cohesion.toFixed(1)}</Text>
        <Text style={styles.label}>Leadership Strength: {data.leadership.toFixed(1)}</Text>
        <Text style={styles.label}>Team Alignment: {data.alignment.toFixed(1)}</Text>
        <Text style={styles.label}>Communication Quality: {data.communication.toFixed(1)}</Text>
        <Text style={styles.label}>Motivation Level: {data.motivation.toFixed(1)}</Text>
        <Text style={styles.label}>Conflict Level: {data.conflict.toFixed(1)}</Text>
        <Text style={styles.label}>Trust Level: {data.trust.toFixed(1)}</Text>

        <Text style={styles.label}>Culture Stability: {data.stability.toFixed(1)}</Text>

        <Text
          style={[
            styles.band,
            data.cultureBand === "HIGH"
              ? styles.high
              : data.cultureBand === "MEDIUM"
              ? styles.medium
              : styles.low,
          ]}
        >
          {data.cultureBand}
        </Text>

        <Text style={styles.label}>
          Culture Adjustment: £{data.cultureAdjustment.toLocaleString()}
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
