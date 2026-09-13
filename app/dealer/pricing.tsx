import React from "react";
import { PricingBrainScreen } from "../../src/features/dealer-ai/screens/PricingBrainScreen";
import { getGlobalAutomotiveAISuite } from "../../src/features/dealer-ai/DealerIntelligenceAPI";

export default function Pricing() {
  const oems = [
    {
      name: "Ford",
      productionCost: 12000,
      wholesalePrice: 15000,
      avgDeliveryTimeDays: 14,
      globalCapacity: 0.8,
    },
    {
      name: "BMW",
      productionCost: 18000,
      wholesalePrice: 23000,
      avgDeliveryTimeDays: 10,
      globalCapacity: 0.7,
    },
    {
      name: "Toyota",
      productionCost: 11000,
      wholesalePrice: 14000,
      avgDeliveryTimeDays: 12,
      globalCapacity: 0.9,
    },
  ];

  const regionsIntel = [
    {
      name: "UK",
      dealerNetworks: [
        {
          name: "AutoGroup UK",
          branches: [
            {
              name: "AutoGroup London",
              region: "London",
              vehicles: [],
              leads: [],
            },
          ],
        },
      ],
      economicIndicators: {
        inflation: 3.2,
        interestRate: 4.8,
        consumerConfidence: 0.72,
      },
    },
  ];

  const economics = {
    globalInflation: 3.2,
    shippingCostIndex: 1.4,
    commodityPrices: 0.9,
    energyCost: 1.1,
  };

  const ai = getGlobalAutomotiveAISuite(oems, regionsIntel, economics);

  const pricing = regionsIntel.map(region => {
    const demandScore =
      region.economicIndicators.consumerConfidence * 10 -
      region.economicIndicators.inflation * 1.5;

    const supplyScore =
      oems.reduce((acc, o) => acc + o.globalCapacity, 0) / oems.length -
      economics.shippingCostIndex * 0.4;

    const marketPressure =
      economics.globalInflation +
      economics.commodityPrices +
      economics.energyCost;

    const basePrice = 15000; // placeholder baseline

    const recommendedRetail =
      basePrice +
      demandScore * 150 -
      supplyScore * 200 +
      marketPressure * 100;

    const recommendedTrade = recommendedRetail * 0.85;

    const riskScore =
      demandScore * 0.4 +
      supplyScore * -0.3 +
      marketPressure * 0.3;

    const riskBand =
      riskScore > 5 ? "HIGH" : riskScore > 3 ? "MEDIUM" : "LOW";

    const recommendation =
      riskBand === "HIGH"
        ? "High volatility — price defensively and avoid overstocking."
        : riskBand === "MEDIUM"
        ? "Moderate pressure — adjust pricing gradually."
        : "Stable conditions — safe to price aggressively.";

    return {
      region: region.name,
      recommendedRetail,
      recommendedTrade,
      demandScore,
      supplyScore,
      marketPressure,
      riskBand,
      recommendation,
    };
  });

  return <PricingBrainScreen data={pricing} />;
}
