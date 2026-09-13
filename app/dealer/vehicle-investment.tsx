import React from "react";
import { VehicleInvestmentBrainScreen } from "../../src/features/dealer-ai/screens/VehicleInvestmentBrainScreen";

export default function VehicleInvestment() {
  const vehicles = [
    {
      vin: "WDB123456789",
      purchasePrice: 8500,
      demand: 6.1,
      supply: 4.2,
      reliability: 7.2,
      risk: 4.8,
      ageYears: 5,
    },
    {
      vin: "JHM987654321",
      purchasePrice: 11200,
      demand: 7.3,
      supply: 3.1,
      reliability: 8.4,
      risk: 3.1,
      ageYears: 3,
    },
  ];

  const investmentData = vehicles.map(v => {
    const appreciationPotential = (v.reliability - v.ageYears * 0.3) / 2;
    const valueStability = 10 - v.ageYears * 0.7 - v.risk * 0.4;

    const riskAdjustedROI =
      v.purchasePrice * (v.demand / 10) -
      v.risk * 200 +
      v.reliability * 150;

    const marketTrend = v.demand - v.supply * 0.5;
    const demandMomentum = v.demand - v.ageYears * 0.2;
    const supplyPressure = v.supply * 0.8;

    const investmentScore =
      appreciationPotential * 0.3 +
      valueStability * 0.3 +
      marketTrend * 0.2 +
      demandMomentum * 0.2;

    const investmentBand =
      investmentScore > 6 ? "HIGH" : investmentScore > 3.5 ? "MEDIUM" : "LOW";

    const investmentAdjustment =
      investmentBand === "HIGH"
        ? 1000
        : investmentBand === "MEDIUM"
        ? -300
        : -1500;

    const strategy =
      investmentBand === "HIGH"
        ? "Long‑term hold"
        : investmentBand === "MEDIUM"
        ? "Short‑term flip"
        : "Avoid";

    const recommendation =
      investmentBand === "HIGH"
        ? "Strong investment candidate — excellent long‑term ROI."
        : investmentBand === "MEDIUM"
        ? "Moderate investment — flip within 6–12 months."
        : "Weak investment — avoid or wholesale.";

    return {
      vin: v.vin,
      investmentScore,
      appreciationPotential,
      valueStability,
      riskAdjustedROI,
      marketTrend,
      demandMomentum,
      supplyPressure,
      investmentBand,
      investmentAdjustment,
      strategy,
      recommendation,
    };
  });

  return <VehicleInvestmentBrainScreen data={investmentData} />;
}
