import React from "react";
import { DealerEconomicsBrainScreen } from "../../src/features/dealer-ai/screens/DealerEconomicsBrainScreen";

export default function DealerEconomics() {
  const data = {
    efficiency: 7.2,
    costStructure: 6.4,
    revenueStrength: 7.8,
    marginStrength: 6.9,
    stockEconomics: 6.1,
    labourEconomics: 5.8,
    leadEconomics: 7.0,
  };

  const stability =
    data.efficiency * 0.25 +
    data.revenueStrength * 0.25 +
    data.marginStrength * 0.2 +
    data.stockEconomics * 0.15 +
    data.labourEconomics * 0.15;

  const economicsBand =
    stability > 7 ? "HIGH" : stability > 4.5 ? "MEDIUM" : "LOW";

  const economicsAdjustment =
    economicsBand === "HIGH"
      ? 6000
      : economicsBand === "MEDIUM"
      ? 1500
      : -4000;

  const recommendation =
    economicsBand === "HIGH"
      ? "Strong economic foundation — expand operations."
      : economicsBand === "MEDIUM"
      ? "Moderate economics — optimise cost structure."
      : "Weak economics — reduce exposure and stabilise cash flow.";

  return (
    <DealerEconomicsBrainScreen
      data={{
        ...data,
        stability,
        economicsBand,
        economicsAdjustment,
        recommendation,
      }}
    />
  );
}
