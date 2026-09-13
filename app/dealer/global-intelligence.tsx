import React from "react";
import { getGlobalAutomotiveAISuite } from "../../src/features/dealer-ai/DealerIntelligenceAPI";

function GlobalIntelligenceScreen({ data }: { data: any }) {
  return (
    <div>
      <h1>Global Intelligence</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

export default function GlobalIntelligence() {
  // ⭐ OEMs (FIRST ARGUMENT)
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

  // ⭐ Regions (SECOND ARGUMENT)
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
            {
              name: "AutoGroup Manchester",
              region: "Manchester",
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
    {
      name: "EU",
      dealerNetworks: [
        {
          name: "EuroAuto",
          branches: [
            {
              name: "EuroAuto Berlin",
              region: "Berlin",
              vehicles: [],
              leads: [],
            },
          ],
        },
      ],
      economicIndicators: {
        inflation: 2.4,
        interestRate: 3.1,
        consumerConfidence: 0.68,
      },
    },
  ];

  // ⭐ Economics (THIRD ARGUMENT)
  const economics = {
    globalInflation: 3.2,
    shippingCostIndex: 1.4,
    commodityPrices: 0.9,
    energyCost: 1.1,
  };

  // ⭐ CORRECT CALL — OEMs FIRST, Regions SECOND, Economics THIRD
  const ai = getGlobalAutomotiveAISuite(oems, regionsIntel, economics);

  return <GlobalIntelligenceScreen data={ai.globalIntel} />;
}

