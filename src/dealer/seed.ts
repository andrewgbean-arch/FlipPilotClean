import { saveDealerStock } from "@/dealer/storage";

export async function seedDealerStock() {
  await saveDealerStock([
    {
      id: "D1",
      title: "2018 Ford Fiesta 1.0 EcoBoost",
      buyPrice: 4500,
      valuation: 6200,
      sellPrice: null,                     // ⭐ REQUIRED
      flipScore: 78,
      mot: { expiryDate: "2026-09-12" },
      timestamp: new Date().toISOString(), // ⭐ REQUIRED
    },
    {
      id: "D2",
      title: "2017 BMW 320d M Sport",
      buyPrice: 9000,
      valuation: 11500,
      sellPrice: null,                     // ⭐ REQUIRED
      flipScore: 84,
      mot: { expiryDate: "2026-08-01" },
      timestamp: new Date().toISOString(), // ⭐ REQUIRED
    }
  ]);
}

