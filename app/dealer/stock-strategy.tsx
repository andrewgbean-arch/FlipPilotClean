import React from "react";
import { CrossCountryStockStrategyScreen } from "../../src/features/dealer-ai/screens/CrossCountryStockStrategyScreen";
import { getGlobalAutomotiveAISuite } from "../../src/features/dealer-ai/DealerIntelligenceAPI";

export default function StockStrategy() {
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

  return <CrossCountryStockStrategyScreen data={ai.stockStrategy} />;
}
