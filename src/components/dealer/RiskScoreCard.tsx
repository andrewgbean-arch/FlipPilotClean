import React from "react";
import { View, Text } from "react-native";

/* ⭐ Colour-coded risk band helper */
const riskColor = (band: "Low" | "Medium" | "High", theme: any) => {
  switch (band) {
    case "Low":
      return theme.success;
    case "Medium":
      return theme.warning;
    case "High":
      return theme.danger;
    default:
      return theme.secondary;
  }
};

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
      {/* ⭐ Band Header */}
      <Text
        style={{
          color: riskColor(risk.band, theme),
          fontSize: 22,
          fontWeight: "900",
          marginBottom: 10,
        }}
      >
        {risk.band} Risk Deal
      </Text>

      {/* ⭐ Total Risk */}
      <Text style={{ color: theme.white, fontSize: 16 }}>
        Total Risk: {risk.totalRisk}%
      </Text>

      {/* ⭐ Breakdown */}
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
