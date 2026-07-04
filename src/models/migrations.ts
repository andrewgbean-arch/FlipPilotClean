import { FlipRecord } from "./FlipRecord";

// ⭐ Normalise ANY old record into the new FlipRecord shape
export function migrateRecord(old: any): FlipRecord {
  return {
    id: old.id,
    title: old.title,
    image: old.image ?? null,

    buyPrice: old.buyPrice ?? 0,
    sellPrice: old.sellPrice ?? 0,
    profit: old.profit ?? 0,
    roi: old.roi ?? null,

    barcode: old.barcode ?? null,

    favourite: old.favourite ?? false,

    timestamp: old.timestamp ?? new Date().toISOString(),

    market: old.market ?? {
      retailPrice: null,
      usedPrice: null,
      sellThroughRating: null,
      demand: null,
      riskScore: null,
      flipDifficulty: null,
    },
  };
}
