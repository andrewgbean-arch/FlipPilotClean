import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface MarketplaceRankingNode {
  platform: string;
  visibility: number;
  engagement: number;
  buyerIntent: number;
  searchRank: number;
  competitorRank: number;
  listingQuality: number;
  platformStrength: string;
  platformWeakness: string;
  marketplaceBand: string;
  marketplaceAdjustment: number;
  recommendation: string;
}

interface Props {
  data: MarketplaceRankingNode[];
}

export const MarketplaceRankingBrainScreen: React.FC<Props> = ({ data }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🌐 Marketplace Ranking Brain</Text>

      {data.map((node, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.platform}>{node.platform}</Text>

          <Text style={styles.label}>Visibility Score: {node.visibility.toFixed(1)}</Text>
          <Text style={styles.label}>Engagement Score: {node.engagement.toFixed(1)}</Text>
          <Text style={styles.label}>Buyer Intent: {node.buyerIntent.toFixed(1)}</Text>

          <Text style={styles.label}>Search Rank: #{node.searchRank}</Text>
          <Text style={styles.label}>Competitor Rank: #{node.competitorRank}</Text>

          <Text style={styles.label}>Listing Quality: {node.listingQuality.toFixed(1)}</Text>

          <Text style={styles.sectionTitle}>Platform Strength</Text>
          <Text style={styles.value}>{node.platformStrength}</Text>

          <Text style={styles.sectionTitle}>Platform Weakness</Text>
          <Text style={styles.value}>{node.platformWeakness}</Text>

          <Text
            style={[
              styles.band,
              node.marketplaceBand === "HIGH"
                ? styles.high
                : node.marketplaceBand === "MEDIUM"
                ? styles.medium
                : styles.low,
            ]}
          >
            {node.marketplaceBand}
          </Text>

          <Text style={styles.label}>
            Marketplace Adjustment: £{node.marketplaceAdjustment.toLocaleString()}
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
  platform: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  label: { fontSize: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 12 },
  value: { fontSize: 16, color: "#666", marginBottom: 6 },
  band: { fontSize: 20, fontWeight: "bold", marginVertical: 10 },
  high: { color: "#4cd964" },
  medium: { color: "#ffcc00" },
  low: { color: "#ff3b30" },
  recommendation: { fontSize: 16, fontStyle: "italic", color: "#444" },
});
