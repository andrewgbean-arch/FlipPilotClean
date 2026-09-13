import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface LeadNode {
  name: string;
  intent: number;
  engagement: number;
  behaviour: number;
  risk: number;
  value: number;
  urgency: number;
  conversion: number;
  leadBand: string;
  leadAdjustment: number;
  recommendation: string;
}

interface Props {
  data: LeadNode[];
}

export const LeadIntelligenceBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🎯 Lead Intelligence Brain</Text>

      {data.map((lead, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.name}>{lead.name}</Text>

          <Text style={styles.label}>Intent Score: {lead.intent.toFixed(1)}</Text>
          <Text style={styles.label}>Engagement Score: {lead.engagement.toFixed(1)}</Text>
          <Text style={styles.label}>Behaviour Score: {lead.behaviour.toFixed(1)}</Text>
          <Text style={styles.label}>Risk Score: {lead.risk.toFixed(1)}</Text>
          <Text style={styles.label}>Value Score: {lead.value.toFixed(1)}</Text>
          <Text style={styles.label}>Urgency Score: {lead.urgency.toFixed(1)}</Text>

          <Text style={styles.label}>
            Conversion Probability: {lead.conversion.toFixed(1)}%
          </Text>

          <Text
            style={[
              styles.band,
              lead.leadBand === "HIGH"
                ? styles.high
                : lead.leadBand === "MEDIUM"
                ? styles.medium
                : styles.low,
            ]}
          >
            {lead.leadBand}
          </Text>

          <Text style={styles.label}>
            Lead Adjustment: £{lead.leadAdjustment.toLocaleString()}
          </Text>

          <Text style={styles.recommendation}>{lead.recommendation}</Text>
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
  band: { fontSize: 20, fontWeight: "bold", marginVertical: 10 },
  high: { color: "#4cd964" },
  medium: { color: "#ffcc00" },
  low: { color: "#ff3b30" },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
