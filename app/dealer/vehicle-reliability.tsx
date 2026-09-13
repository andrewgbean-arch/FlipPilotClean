import React from "react";
import { VehicleReliabilityBrainScreen } from "../../src/features/dealer-ai/screens/VehicleReliabilityBrainScreen";

export default function VehicleReliability() {
  const vehicles = [
    {
      vin: "WDB123456789",
      mileage: 72000,
      ageYears: 5,
      serviceEvents: 12,
      oemReliability: 8.2,
      modelReliability: 7.8,
    },
    {
      vin: "JHM987654321",
      mileage: 41000,
      ageYears: 3,
      serviceEvents: 6,
      oemReliability: 9.1,
      modelReliability: 8.7,
    },
  ];

  const reliabilityData = vehicles.map(v => {
    const engineReliability = 10 - v.mileage / 15000;
    const electricalReliability = 10 - v.ageYears * 0.7;
    const drivetrainReliability = 10 - v.ageYears * 0.5;
    const serviceReliability = Math.min(10, v.serviceEvents * 0.6);

    const combinedReliability =
      engineReliability * 0.3 +
      electricalReliability * 0.15 +
      drivetrainReliability * 0.15 +
      v.oemReliability * 0.2 +
      v.modelReliability * 0.1 +
      serviceReliability * 0.1;

    const reliabilityBand =
      combinedReliability > 7 ? "HIGH" : combinedReliability > 4 ? "MEDIUM" : "LOW";

    const predictedFailureCost =
      reliabilityBand === "HIGH"
        ? 300
        : reliabilityBand === "MEDIUM"
        ? 900
        : 1800;

    const reliabilityAdjustment =
      reliabilityBand === "HIGH"
        ? 600
        : reliabilityBand === "MEDIUM"
        ? -300
        : -1200;

    const flipReliability =
      reliabilityBand === "HIGH"
        ? "Excellent"
        : reliabilityBand === "MEDIUM"
        ? "Moderate"
        : "Poor";

    const recommendation =
      reliabilityBand === "HIGH"
        ? "Strong reliability — excellent flip candidate."
        : reliabilityBand === "MEDIUM"
        ? "Moderate reliability — flip with caution."
        : "Low reliability — avoid or wholesale.";

    return {
      vin: v.vin,
      engineReliability,
      electricalReliability,
      drivetrainReliability,
      oemReliability: v.oemReliability,
      modelReliability: v.modelReliability,
      serviceReliability,
      combinedReliability,
      reliabilityBand,
      predictedFailureCost,
      reliabilityAdjustment,
      flipReliability,
      recommendation,
    };
  });

  return <VehicleReliabilityBrainScreen data={reliabilityData} />;
}
