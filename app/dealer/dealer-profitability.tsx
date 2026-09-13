import React from "react";
import { DealerProfitabilityBrainScreen } from "../../src/features/dealer-ai/screens/DealerProfitabilityBrainScreen";

export default function DealerProfitability() {
  const vehiclesSold = 42;

  const data = {
    grossProfit: 128000,
    netProfit: 74000,
    profitPerVehicle: 74000 / vehiclesSold,

    departmentProfit: {
      sales: 52000,
      service: 31000,
      finance: 21000,
      parts: 24000,
    },

    staffPerformance: 7.4,
    efficiency: 6.8,
    leakage: 3.2,
    stability: 7.1,

    profitBand:
      74000 > 90000 ? "HIGH" : 74000 > 45000 ? "MEDIUM" : "LOW",

    profitAdjustment:
      74000 > 90000 ? 5000 : 74000 > 45000 ? 1500 : -4000,

    strategy:
      74000 > 90000
        ? "Expand operations — strong profitability."
        : 74000 > 45000
        ? "Optimise processes — moderate profitability."
        : "Reduce cost exposure — weak profitability.",

    recommendation:
      74000 > 90000
        ? "Dealer is highly profitable — consider scaling inventory."
        : 74000 > 45000
        ? "Dealer is moderately profitable — improve efficiency."
        : "Dealer profitability is weak — address leakage immediately.",
  };

  return <DealerProfitabilityBrainScreen data={data} />;
}
