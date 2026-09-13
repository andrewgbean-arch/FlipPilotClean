import React from "react";
import { BuyerBehaviourBrainScreen } from "../../src/features/dealer-ai/screens/BuyerBehaviourBrainScreen";

export default function BuyerBehaviour() {
  const buyers = [
    {
      name: "John Carter",
      behaviourPattern: 7.8,
      decisionStyle: "Emotional",
      riskBehaviour: 3.2,
      priceSensitivity: 6.1,
      engagementBehaviour: 7.4,
      buyingWindow: "3–7 days",
      emotionalDrivers: ["Trust", "Brand prestige", "Feeling of safety"],
      logicalDrivers: ["Price fairness", "Warranty length", "Running costs"],
    },
    {
      name: "Emily Davis",
      behaviourPattern: 6.2,
      decisionStyle: "Balanced",
      riskBehaviour: 4.9,
      priceSensitivity: 7.1,
      engagementBehaviour: 5.8,
      buyingWindow: "7–14 days",
      emotionalDrivers: ["Comfort", "Design", "Colour"],
      logicalDrivers: ["Finance terms", "Mileage", "Service history"],
    },
    {
      name: "Mark Thompson",
      behaviourPattern: 4.1,
      decisionStyle: "Logical",
      riskBehaviour: 6.8,
      priceSensitivity: 8.2,
      engagementBehaviour: 3.9,
      buyingWindow: "14–30 days",
      emotionalDrivers: ["None"],
      logicalDrivers: ["Price", "Depreciation", "Fuel economy"],
    },
  ];

  const data = buyers.map(b => {
    const score =
      b.behaviourPattern * 0.4 +
      (10 - b.riskBehaviour) * 0.2 +
      (10 - b.priceSensitivity) * 0.2 +
      b.engagementBehaviour * 0.2;

    const behaviourBand =
      score > 7 ? "HIGH" : score > 4.5 ? "MEDIUM" : "LOW";

    const behaviourAdjustment =
      behaviourBand === "HIGH"
        ? 1100
        : behaviourBand === "MEDIUM"
        ? 300
        : -700;

    const recommendation =
      behaviourBand === "HIGH"
        ? "High‑intent buyer — close aggressively."
        : behaviourBand === "MEDIUM"
        ? "Moderate‑intent buyer — nurture and follow up."
        : "Low‑intent buyer — avoid heavy time investment.";

    return {
      ...b,
      behaviourBand,
      behaviourAdjustment,
      recommendation,
    };
  });

  return <BuyerBehaviourBrainScreen data={data} />;
}
