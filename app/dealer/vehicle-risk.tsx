import React from "react";
import { VehicleRiskBrainScreen } from "../../src/features/dealer-ai/screens/VehicleRiskBrainScreen";

export default function VehicleRisk() {
  const vehicles = [
    {
      vin: "WDB123456789",
      mileage: 72000,
      ageYears: 5,
      owners: 3,
      damageEvents: 1,
      marketPressure: 4.2,
    },
    {
      vin: "JHM987654321",
      mileage: 41000,
      ageYears: 3,
      owners: 1,
      damageEvents: 0,
      marketPressure: 2.1,
    },
  ];

  const economics = {
    inflation: 3.2,
    shippingCostIndex: 1.4,
    commodityPrices: 0.9,
    energyCost: 1.1,
  };

  const riskData = vehicles.map(v => {
    const mechanicalRisk = v.mileage / 20000 + v.ageYears * 0.6;
    const electricalRisk = v.ageYears * 0.4;
    const ownershipRisk = v.owners * 1.2;
    const historyRisk = v.damageEvents * 2.5;
    const marketRisk = v.marketPressure * 1.1;
    const economicRisk =
      economics.inflation * 0.4 +
      economics.commodityPrices * 0.3 +
      economics.energyCost * 0.3;

    const combinedRisk =
      mechanicalRisk * 0.35 +
      electricalRisk * 0.15 +
      ownershipRisk * 0.15 +
      historyRisk * 0.15 +
      marketRisk * 0.1 +
      economicRisk * 0.1;

    const riskBand =
      combinedRisk > 6 ? "HIGH" : combinedRisk > 3.5 ? "MEDIUM" : "LOW";

    const riskAdjustment =
      riskBand === "HIGH"
        ? -2000
        : riskBand === "MEDIUM"
        ? -800
        : 400;

    const flipSafety =
      riskBand === "LOW"
        ? "Safe"
        : riskBand === "MEDIUM"
        ? "Caution"
        : "Unsafe";

    const recommendation =
      riskBand === "HIGH"
        ? "High risk — avoid flipping or wholesale immediately."
        : riskBand === "MEDIUM"
        ? "Moderate risk — flip only with margin protection."
        : "Low risk — strong flip candidate.";

    return {
      vin: v.vin,
      mechanicalRisk,
      electricalRisk,
      ownershipRisk,
      historyRisk,
      marketRisk,
      economicRisk,
      combinedRisk,
      riskBand,
      riskAdjustment,
      flipSafety,
      recommendation,
    };
  });

  return <VehicleRiskBrainScreen data={riskData} />;
}
