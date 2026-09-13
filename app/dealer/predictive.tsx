import React from "react";
import { PredictiveDemandBrainScreen } from "../../src/features/dealer-ai/screens/PredictiveDemandBrainScreen";
import { getGlobalAutomotiveAISuite } from "../../src/features/dealer-ai/DealerIntelligenceAPI";

export default function Predictive() {
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

  const predictive = regionsIntel.map(region => {
    const demandForecast =
      region.economicIndicators.consumerConfidence * 10 +
      region.economicIndicators.inflation * -2;

    const supplyForecast =
      oems.reduce((acc, o) => acc + o.globalCapacity, 0) / oems.length -
      economics.shippingCostIndex * 0.5;

    const pricePressure =
      economics.globalInflation +
      economics.commodityPrices +
      economics.energyCost;

    const riskScore =
      demandForecast * 0.4 +
      supplyForecast * -0.3 +
      pricePressure * 0.3;

    const riskBand =
      riskScore > 5 ? "HIGH" : riskScore > 3 ? "MEDIUM" : "LOW";

    const recommendation =
      riskBand === "HIGH"
        ? "Demand volatility expected — reduce stock exposure."
        : riskBand === "MEDIUM"
        ? "Monitor trends closely — adjust purchasing gradually."
        : "Stable outlook — safe to expand inventory.";

    return {
      region: region.name,
      demandForecast,
      supplyForecast,
      pricePressure,
      riskBand,
      recommendation,
    };
  });

  return <PredictiveDemandBrainScreen data={predictive} />;
}
