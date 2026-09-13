import React from "react";
import { OEMIntelligenceBrainScreen } from "../../src/features/dealer-ai/screens/OEMIntelligenceBrainScreen";
import { getGlobalAutomotiveAISuite } from "../../src/features/dealer-ai/DealerIntelligenceAPI";

export default function OEMIntel() {
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

  const oemIntel = oems.map(oem => ({
    oem: oem.name,
    productionCost: oem.productionCost,
    wholesalePrice: oem.wholesalePrice,
    avgDeliveryTimeDays: oem.avgDeliveryTimeDays,
    globalCapacity: oem.globalCapacity,

    supplyStress: oem.globalCapacity < 0.75 ? "HIGH" : "LOW",
    globalDemand: Math.round(oem.wholesalePrice / oem.productionCost * 10),

    economicsImpact: {
      inflation: economics.globalInflation,
      shippingCostIndex: economics.shippingCostIndex,
      commodityPrices: economics.commodityPrices,
      energyCost: economics.energyCost,
    },

    recommendation:
      oem.globalCapacity < 0.75
        ? "Increase production capacity and reduce delivery delays."
        : "Stable supply — maintain current production strategy.",
  }));

  return <OEMIntelligenceBrainScreen data={oemIntel} />;
}


