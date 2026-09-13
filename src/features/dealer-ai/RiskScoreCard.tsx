import React from "react";
import { View, Text } from "react-native";

export default function RiskScoreCard({ risk, theme }: any) {
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
        Deal Risk Summary
      </Text>

      <Text style={{ color: theme.white, marginTop: 6 }}>
        Total Risk: {risk.totalRisk}%
      </Text>

      <Text style={{ color: theme.secondary }}>
        Band: {risk.band}
      </Text>

      <Text style={{ color: theme.muted, marginTop: 10 }}>
        MOT Risk: {risk.motRisk}%
      </Text>

      <Text style={{ color: theme.muted }}>
        Finance Risk: {risk.financeRisk}%
      </Text>

      <Text style={{ color: theme.muted }}>
        Affordability Risk: {risk.affordabilityRisk}%
      </Text>

      <Text style={{ color: theme.muted }}>
        Buyer Risk: {risk.buyerRisk}%
      </Text>
    </View>
  );
}
