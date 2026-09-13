import React from "react";
import { VehicleLifecycleBrainScreen } from "../../src/features/dealer-ai/screens/VehicleLifecycleBrainScreen";

export default function VehicleLifecycle() {
  const vehicles = [
    {
      vin: "WDB123456789",
      mileage: 72000,
      ageYears: 5,
      reliability: 7.2,
      risk: 4.8,
      demand: 6.1,
    },
    {
      vin: "JHM987654321",
      mileage: 41000,
      ageYears: 3,
      reliability: 8.4,
      risk: 3.1,
      demand: 7.3,
    },
  ];

  const lifecycleData = vehicles.map(v => {
    const remainingLifeYears = 12 - v.ageYears - v.mileage / 50000;

    const failureWindowMonths = Math.max(6, v.mileage / 15000 * 4);

    const majorFailureProb = (v.mileage / 100000 + v.ageYears / 10) / 2;

    const valueCollapseMonths = Math.max(12, v.ageYears * 3 + v.mileage / 20000);

    const demandCollapseMonths = Math.max(10, (10 - v.demand) * 2);

    const riskTrajectory = v.risk + v.ageYears * 0.4;

    const maintenanceTrajectory = v.mileage / 10000 * 150;

    const lifecycleScore =
      remainingLifeYears * 0.3 +
      (1 - majorFailureProb) * 0.3 +
      v.reliability * 0.2 +
      v.demand * 0.2;

    const lifecycleBand =
      lifecycleScore > 6 ? "HIGH" : lifecycleScore > 3.5 ? "MEDIUM" : "LOW";

    const lifecycleAdjustment =
      lifecycleBand === "HIGH"
        ? 800
        : lifecycleBand === "MEDIUM"
        ? -300
        : -1200;

    const optimalFlipWindow =
      lifecycleBand === "HIGH"
        ? "0–12 months"
        : lifecycleBand === "MEDIUM"
        ? "0–6 months"
        : "Immediate";

    const optimalDisposalWindow =
      lifecycleBand === "HIGH"
        ? "After 24+ months"
        : lifecycleBand === "MEDIUM"
        ? "12–18 months"
        : "0–3 months";

    const recommendation =
      lifecycleBand === "HIGH"
        ? "Strong long-term outlook — excellent flip or hold candidate."
        : lifecycleBand === "MEDIUM"
        ? "Moderate outlook — flip within 6 months."
        : "Weak outlook — dispose quickly.";

    return {
      vin: v.vin,
      remainingLifeYears,
      failureWindowMonths,
      majorFailureProb,
      valueCollapseMonths,
      demandCollapseMonths,
      riskTrajectory,
      maintenanceTrajectory,
      lifecycleBand,
      lifecycleAdjustment,
      optimalFlipWindow,
      optimalDisposalWindow,
      recommendation,
    };
  });

  return <VehicleLifecycleBrainScreen data={lifecycleData} />;
}
