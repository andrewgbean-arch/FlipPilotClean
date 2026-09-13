import React from "react";
import { VehicleConditionBrainScreen } from "../../src/features/dealer-ai/screens/VehicleConditionBrainScreen";

export default function VehicleCondition() {
  const vehicles = [
    {
      vin: "WDB123456789",
      mileage: 72000,
      ageYears: 5,
    },
    {
      vin: "JHM987654321",
      mileage: 41000,
      ageYears: 3,
    },
  ];

  const conditionData = vehicles.map(v => {
    const mechanicalScore = 10 - v.mileage / 15000;
    const cosmeticScore = 10 - v.ageYears * 0.8;
    const reliabilityScore = 8.5 - v.ageYears * 0.3;
    const depreciationScore = 10 - v.ageYears * 1.2;

    const conditionScore =
      mechanicalScore * 0.4 +
      cosmeticScore * 0.2 +
      reliabilityScore * 0.2 +
      depreciationScore * 0.2;

    const riskBand =
      conditionScore < 4 ? "HIGH" : conditionScore < 7 ? "MEDIUM" : "LOW";

    const reconCost =
      (10 - mechanicalScore) * 120 +
      (10 - cosmeticScore) * 80;

    const retailAdjustment = (conditionScore - 7) * 300;

    const flipPotential =
      riskBand === "LOW"
        ? "Excellent"
        : riskBand === "MEDIUM"
        ? "Moderate"
        : "Poor";

    return {
      vin: v.vin,
      mileage: v.mileage,
      ageYears: v.ageYears,
      mechanicalScore,
      cosmeticScore,
      reliabilityScore,
      depreciationScore,
      conditionScore,
      riskBand,
      reconCost,
      retailAdjustment,
      flipPotential,
    };
  });

  return <VehicleConditionBrainScreen data={conditionData} />;
}
