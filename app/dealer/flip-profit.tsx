import React from "react";
import { FlipProfitBrainScreen } from "../../src/features/dealer-ai/screens/FlipProfitBrainScreen";

export default function FlipProfit() {
  const vehicles = [
    {
      vin: "WDB123456789",
      purchasePrice: 8500,
      reconCost: 600,
      mileage: 72000,
      ageYears: 5,
    },
    {
      vin: "JHM987654321",
      purchasePrice: 11200,
      reconCost: 300,
      mileage: 41000,
      ageYears: 3,
    },
  ];

  const economics = {
    inflation: 3.2,
    shippingCostIndex: 1.4,
    commodityPrices: 0.9,
    energyCost: 1.1,
  };

  const flipProfit = vehicles.map(v => {
    const demandAdj = (10 - v.ageYears) * 120;
    const supplyAdj = (v.mileage < 60000 ? 300 : -200);
    const marketAdj =
      economics.inflation * -50 +
      economics.commodityPrices * -40 +
      economics.energyCost * -30;

    const recommendedRetail =
      v.purchasePrice +
      demandAdj +
      supplyAdj +
      marketAdj +
      1200;

    const recommendedTrade = recommendedRetail * 0.85;

    const trueCost = v.purchasePrice + v.reconCost;

    const netProfit = recommendedRetail - trueCost;

    const profitBand =
      netProfit > 2000 ? "HIGH" : netProfit > 800 ? "MEDIUM" : "LOW";

    const viability =
      profitBand === "HIGH"
        ? "Excellent"
        : profitBand === "MEDIUM"
        ? "Moderate"
        : "Poor";

    const recommendation =
      profitBand === "HIGH"
        ? "Strong flip potential — list immediately."
        : profitBand === "MEDIUM"
        ? "Good flip — consider light negotiation."
        : "Low margin — avoid or wholesale quickly.";

    return {
      vin: v.vin,
      trueCost,
      reconCost: v.reconCost,
      recommendedRetail,
      recommendedTrade,
      demandAdj,
      supplyAdj,
      marketAdj,
      netProfit,
      profitBand,
      viability,
      recommendation,
    };
  });

  return <FlipProfitBrainScreen data={flipProfit} />;
}
