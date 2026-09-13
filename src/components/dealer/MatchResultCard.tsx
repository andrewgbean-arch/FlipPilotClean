import React from "react";
import { View, Text } from "react-native";

export default function MatchResultCard({ result, theme }: any) {
  return (
    <View
      style={{
        backgroundColor: theme.card,
        padding: 16,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
        marginBottom: 20,
      }}
    >
      <Text style={{ color: theme.accent, fontSize: 20, fontWeight: "800" }}>
        {result.vehicle.make} {result.vehicle.model}
      </Text>

      <Text style={{ color: theme.white, marginTop: 6 }}>
        Match Score: {result.score}/100
      </Text>

      <Text style={{ color: theme.secondary }}>
        Match Band: {result.band}
      </Text>

      <Text style={{ color: theme.white, marginTop: 6 }}>
        Closing Probability: {result.closingProbability}%
      </Text>

      <Text style={{ color: theme.muted, marginTop: 6 }}>
        Recommended Deposit: £{result.recommendedDeposit}
      </Text>
    </View>
  );
}
