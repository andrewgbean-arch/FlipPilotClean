import React from "react";
import { VehicleHistoryBrainScreen } from "../../src/features/dealer-ai/screens/VehicleHistoryBrainScreen";

export default function VehicleHistory() {
  const vehicles = [
    {
      vin: "WDB123456789",
      owners: 3,
      serviceEvents: 12,
      damageEvents: 1,
      insuranceClaims: 1,
      mileageIntegrity: 9.2,
    },
    {
      vin: "JHM987654321",
      owners: 1,
      serviceEvents: 6,
      damageEvents: 0,
      insuranceClaims: 0,
      mileageIntegrity: 9.8,
    },
  ];

  const historyData = vehicles.map(v => {
    const ownershipScore = 10 - v.owners * 1.5;
    const serviceScore = Math.min(10, v.serviceEvents * 0.7);
    const damageScore = 10 - v.damageEvents * 3;
    const claimScore = 10 - v.insuranceClaims * 2.5;

    const historyScore =
      ownershipScore * 0.25 +
      serviceScore * 0.25 +
      damageScore * 0.25 +
      claimScore * 0.25;

    const riskBand =
      historyScore < 4 ? "HIGH" : historyScore < 7 ? "MEDIUM" : "LOW";

    const historyAdjustment =
      riskBand === "HIGH"
        ? -1500
        : riskBand === "MEDIUM"
        ? -600
        : 300;

    const flipPotential =
      riskBand === "LOW"
        ? "Excellent"
        : riskBand === "MEDIUM"
        ? "Moderate"
        : "Poor";

    const recommendation =
      riskBand === "HIGH"
        ? "History concerns — price defensively or wholesale."
        : riskBand === "MEDIUM"
        ? "Minor history flags — adjust pricing accordingly."
        : "Clean history — strong retail candidate.";

    return {
      vin: v.vin,
      owners: v.owners,
      serviceEvents: v.serviceEvents,
      damageEvents: v.damageEvents,
      insuranceClaims: v.insuranceClaims,
      mileageIntegrity: v.mileageIntegrity,
      ownershipScore,
      serviceScore,
      damageScore,
      claimScore,
      historyScore,
      riskBand,
      historyAdjustment,
      flipPotential,
      recommendation,
    };
  });

  return <VehicleHistoryBrainScreen data={historyData} />;
}
