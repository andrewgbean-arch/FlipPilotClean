import React from "react";
import { VehicleForecastBrainScreen } from "../../src/features/dealer-ai/screens/VehicleForecastBrainScreen";

export default function VehicleForecast() {
  const vehicles = [
    {
      vin: "WDB123456789",
      mileage: 72000,
      ageYears: 5,
      purchasePrice: 8500,
      reliability: 7.2,
      risk: 4.8,
      demand: 6.1,
    },
    {
      vin: "JHM987654321",
      mileage: 41000,
      ageYears: 3,
      purchasePrice: 11200,
      reliability: 8.4,
      risk: 3.1,
      demand: 7.3,
    },
  ];

  const forecastData = vehicles.map(v => {
    const dep6 = v.purchasePrice * 0.06;
    const dep12 = v.purchasePrice * 0.12;
    const dep24 = v.purchasePrice * 0.22;

    const futureReliability = v.reliability - v.ageYears * 0.3;
    const futureRisk = v.risk + v.ageYears * 0.4;
    const futureMaintenance = v.mileage / 10000 * 120;

    const futureDemand = v.demand - v.ageYears * 0.2;

    const futureProfit =
      v.purchasePrice -
      dep12 -
      futureMaintenance -
      futureRisk * 100;

    const forecastBand =
      futureProfit > 1500 ? "HIGH" : futureProfit > 500 ? "MEDIUM" : "LOW";

    const recommendation =
      forecastBand === "HIGH"
        ? "Strong future outlook — excellent long‑term flip."
        : forecastBand === "MEDIUM"
        ? "Moderate outlook — flip within 6–12 months."
        : "Weak outlook — avoid long‑term holding.";

    return {
      vin: v.vin,
      dep6,
      dep12,
      dep24,
      futureReliability,
      futureRisk,
      futureMaintenance,
      futureDemand,
      futureProfit,
      forecastBand,
      recommendation,
    };
  });

  return <VehicleForecastBrainScreen data={forecastData} />;
}
