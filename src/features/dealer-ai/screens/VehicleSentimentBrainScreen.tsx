import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface VehicleSentimentNode {
  vin: string;
  buyerSentiment: number;
  socialTrend: number;
  brandReputation: number;
  modelReputation: number;
  marketBuzz: number;
  negativeBuzz: number;
  volatility: number;
  sentimentBand: string;
  sentimentAdjustment: number;
  strategy: string;
  recommendation: string;
}

interface Props {
  data: VehicleSentimentNode[];
}

export const VehicleSentimentBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>💬 Vehicle Sentiment Brain</Text>

      {data.map((node, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.vin}>VIN: {node.vin}</Text>

          <Text style={styles.label}>Buyer Sentiment: {node.buyerSentiment.toFixed(1)}</Text>
          <Text style={styles.label}>Social Trend: {node.socialTrend.toFixed(1)}</Text>
          <Text style={styles.label}>Brand Reputation: {node.brandReputation.toFixed(1)}</Text>
          <Text style={styles.label}>Model Reputation: {node.modelReputation.toFixed(1)}</Text>
          <Text style={styles.label}>Market Buzz: {node.marketBuzz.toFixed(1)}</Text>
          <Text style={styles.label}>Negative Buzz: {node.negativeBuzz.toFixed(1)}</Text>
          <Text style={styles.label}>Volatility: {node.volatility.toFixed(1)}</Text>

          <Text style={styles.sectionTitle}>Sentiment Band</Text>
          <Text
            style={[
              styles.band,
              node.sentimentBand === "HIGH"
                ? styles.high
                : node.sentimentBand === "MEDIUM"
                ? styles.medium
                : styles.low,
            ]}
          >
            {node.sentimentBand}
          </Text>

          <Text style={styles.label}>
            Sentiment Adjustment: £{node.sentimentAdjustment.toLocaleString()}
          </Text>

          <Text style={styles.label}>Strategy: {node.strategy}</Text>

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
  vin: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  label: { fontSize: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 12 },
  band: { fontSize: 20, fontWeight: "bold", marginVertical: 10 },
  high: { color: "#4cd964" },
  medium: { color: "#ffcc00" },
  low: { color: "#ff3b30" },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
