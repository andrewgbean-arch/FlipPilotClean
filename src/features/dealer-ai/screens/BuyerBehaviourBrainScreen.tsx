import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface BehaviourNode {
  name: string;
  behaviourPattern: number;
  decisionStyle: string;
  riskBehaviour: number;
  priceSensitivity: number;
  engagementBehaviour: number;
  buyingWindow: string;
  emotionalDrivers: string[];
  logicalDrivers: string[];
  behaviourBand: string;
  behaviourAdjustment: number;
  recommendation: string;
}

interface Props {
  data: BehaviourNode[];
}

export const BuyerBehaviourBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🧠 Buyer Behaviour Brain</Text>

      {data.map((node, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.name}>{node.name}</Text>

          <Text style={styles.label}>
            Behaviour Pattern Score: {node.behaviourPattern.toFixed(1)}
          </Text>

          <Text style={styles.label}>Decision Style: {node.decisionStyle}</Text>

          <Text style={styles.label}>
            Risk Behaviour: {node.riskBehaviour.toFixed(1)}
          </Text>

          <Text style={styles.label}>
            Price Sensitivity: {node.priceSensitivity.toFixed(1)}
          </Text>

          <Text style={styles.label}>
            Engagement Behaviour: {node.engagementBehaviour.toFixed(1)}
          </Text>

          <Text style={styles.label}>Buying Window: {node.buyingWindow}</Text>

          <Text style={styles.sectionTitle}>Emotional Drivers</Text>
          {node.emotionalDrivers.map((d, i) => (
            <Text key={i} style={styles.value}>• {d}</Text>
          ))}

          <Text style={styles.sectionTitle}>Logical Drivers</Text>
          {node.logicalDrivers.map((d, i) => (
            <Text key={i} style={styles.value}>• {d}</Text>
          ))}

          <Text
            style={[
              styles.band,
              node.behaviourBand === "HIGH"
                ? styles.high
                : node.behaviourBand === "MEDIUM"
                ? styles.medium
                : styles.low,
            ]}
          >
            {node.behaviourBand}
          </Text>

          <Text style={styles.label}>
            Behaviour Adjustment: £{node.behaviourAdjustment.toLocaleString()}
          </Text>

          <Text style={styles.recommendation}>{node.recommendation}</Text>
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
  name: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  label: { fontSize: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 12 },
  value: { fontSize: 16, color: "#666", marginBottom: 4 },
  band: { fontSize: 20, fontWeight: "bold", marginVertical: 10 },
  high: { color: "#4cd964" },
  medium: { color: "#ffcc00" },
  low: { color: "#ff3b30" },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
