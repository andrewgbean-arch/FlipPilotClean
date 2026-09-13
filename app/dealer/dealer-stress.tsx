import React from "react";
import { DealerStressBrainScreen } from "../../src/features/dealer-ai/screens/DealerStressBrainScreen";

export default function DealerStress() {
  const data = {
    operational: 6.8,
    financial: 7.4,
    stock: 5.9,
    staff: 6.1,
    compliance: 3.8,
    market: 7.2,
    liquidity: 6.5,
  };

  const stability =
    (10 - data.operational) * 0.15 +
    (10 - data.financial) * 0.2 +
    (10 - data.stock) * 0.15 +
    (10 - data.staff) * 0.15 +
    (10 - data.compliance) * 0.1 +
    (10 - data.market) * 0.15 +
    (10 - data.liquidity) * 0.1;

  const stressBand =
    stability < 4 ? "HIGH" : stability < 7 ? "MEDIUM" : "LOW";

  const stressAdjustment =
    stressBand === "HIGH"
      ? -9000
      : stressBand === "MEDIUM"
      ? -3000
      : 1500;

  const recommendation =
    stressBand === "HIGH"
      ? "Dealer stress is critical — immediate intervention required."
      : stressBand === "MEDIUM"
      ? "Dealer stress is moderate — optimise operations and reduce exposure."
      : "Dealer stress is low — stable environment for growth.";

  return (
    <DealerStressBrainScreen
      data={{
        ...data,
        stability,
        stressBand,
        stressAdjustment,
        recommendation,
      }}
    />
  );
}
