import React from "react";
import { VehicleSentimentBrainScreen } from "../../src/features/dealer-ai/screens/VehicleSentimentBrainScreen";

export default function VehicleSentiment() {
  const vehicles = [
    {
      vin: "WDB123456789",
      brandReputation: 8.1,
      modelReputation: 7.4,
      buyerSentiment: 6.8,
      socialTrend: 5.9,
      marketBuzz: 6.2,
      negativeBuzz: 2.1,
    },
    {
      vin: "JHM987654321",
      brandReputation: 9.0,
      modelReputation: 8.5,
      buyerSentiment: 7.9,
      socialTrend: 7.2,
      marketBuzz: 8.1,
      negativeBuzz: 1.4,
    },
  ];

  const sentimentData = vehicles.map(v => {
    const volatility = Math.abs(v.marketBuzz - v.negativeBuzz);

    const sentimentScore =
      v.buyerSentiment * 0.3 +
      v.socialTrend * 0.2 +
      v.brandReputation * 0.2 +
      v.modelReputation * 0.2 +
      v.marketBuzz * 0.1 -
      v.negativeBuzz * 0.3;

    const sentimentBand =
      sentimentScore > 7 ? "HIGH" : sentimentScore > 4 ? "MEDIUM" : "LOW";

    const sentimentAdjustment =
      sentimentBand === "HIGH"
        ? 900
        : sentimentBand === "MEDIUM"
        ? 200
        : -800;

    const strategy =
      sentimentBand === "HIGH"
        ? "Price aggressively — high buyer enthusiasm."
        : sentimentBand === "MEDIUM"
        ? "Standard pricing — monitor trend shifts."
        : "Price defensively — low sentiment and high risk.";

    const recommendation =
      sentimentBand === "HIGH"
        ? "Strong sentiment — excellent flip candidate."
        : sentimentBand === "MEDIUM"
        ? "Moderate sentiment — flip with caution."
        : "Weak sentiment — avoid long-term holding.";

    return {
      vin: v.vin,
      buyerSentiment: v.buyerSentiment,
      socialTrend: v.socialTrend,
      brandReputation: v.brandReputation,
      modelReputation: v.modelReputation,
      marketBuzz: v.marketBuzz,
      negativeBuzz: v.negativeBuzz,
      volatility,
      sentimentBand,
      sentimentAdjustment,
      strategy,
      recommendation,
    };
  });

  return <VehicleSentimentBrainScreen data={sentimentData} />;
}
