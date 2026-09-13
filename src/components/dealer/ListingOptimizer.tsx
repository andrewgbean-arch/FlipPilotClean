import React from "react";
import { View, Text } from "react-native";

// ⭐ Types for props
type ListingOptimizerProps = {
  vehicles: Array<{
    id: string | number;
    title: string;
    flipScore?: number;
  }>;
  theme: {
    accent: string;
    background: string;
    card: string;
    text: string;
    secondary: string;
  };
};

export default function ListingOptimizer({
  vehicles,
  theme,
}: ListingOptimizerProps) {
  const lowScore = vehicles.filter((v) => (v.flipScore ?? 0) < 40);

  return (
    <View style={{ marginTop: 30 }}>
      <Text
        style={{
          fontSize: 22,
          fontWeight: "700",
          color: theme.accent,
        }}
      >
        Listing Optimizer
      </Text>

      {lowScore.length === 0 && (
        <Text style={{ color: theme.secondary, marginTop: 10 }}>
          All listings look strong.
        </Text>
      )}

      {lowScore.map((v) => (
        <View
          key={v.id}
          style={{
            marginTop: 10,
            padding: 12,
            backgroundColor: theme.card,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: theme.text, fontWeight: "700" }}>
            {v.title}
          </Text>

          <Text style={{ color: theme.secondary }}>
            FlipScore: {v.flipScore}
          </Text>

          <Text style={{ color: theme.secondary }}>
            Suggestion: Improve photos, reduce price, add MOT details.
          </Text>
        </View>
      ))}
    </View>
  );
}
