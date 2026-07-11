// src/features/vehicles/utils/flipScoreEngine.ts

/**
 * FlipScore Engine
 * Generates a 0–100 score based on:
 * - Profit margin
 * - Demand score
 * - Rarity
 * - Condition
 * - Sell speed
 * - AI confidence (optional)
 */

export type FlipScoreInput = {
  buyPrice: number;
  sellPrice: number;
  demandScore: number;      // 0–100
  rarity: string;           // "Common" | "Uncommon" | "Rare" | "Ultra Rare"
  condition: string;        // "Poor" | "Fair" | "Good" | "Excellent"
  sellSpeed: string;        // "Slow" | "Medium" | "Fast"
  aiPriceConfidence?: number; // optional 0–100
};

export const calculateFlipScore = (input: FlipScoreInput): number => {
  const {
    buyPrice,
    sellPrice,
    demandScore,
    rarity,
    condition,
    sellSpeed,
    aiPriceConfidence = 50,
  } = input;

  // -----------------------------------------
  // 1. PROFIT SCORE (0–100)
  // -----------------------------------------
  const profit = sellPrice - buyPrice;
  const profitMargin = profit <= 0 ? 0 : Math.min((profit / buyPrice) * 100, 100);

  // -----------------------------------------
  // 2. RARITY SCORE
  // -----------------------------------------
  const rarityMap: Record<string, number> = {
    "Common": 20,
    "Uncommon": 40,
    "Rare": 70,
    "Ultra Rare": 90,
  };
  const rarityScore = rarityMap[rarity] ?? 30;

  // -----------------------------------------
  // 3. CONDITION SCORE
  // -----------------------------------------
  const conditionMap: Record<string, number> = {
    "Poor": 20,
    "Fair": 40,
    "Good": 70,
    "Excellent": 90,
  };
  const conditionScore = conditionMap[condition] ?? 50;

  // -----------------------------------------
  // 4. SELL SPEED SCORE
  // -----------------------------------------
  const speedMap: Record<string, number> = {
    "Slow": 30,
    "Medium": 60,
    "Fast": 90,
  };
  const sellSpeedScore = speedMap[sellSpeed] ?? 50;

  // -----------------------------------------
  // 5. AI CONFIDENCE (optional)
  // -----------------------------------------
  const aiScore = aiPriceConfidence;

  // -----------------------------------------
  // FINAL WEIGHTED SCORE
  // -----------------------------------------
  const finalScore =
    profitMargin * 0.35 +
    demandScore * 0.20 +
    rarityScore * 0.15 +
    conditionScore * 0.15 +
    sellSpeedScore * 0.10 +
    aiScore * 0.05;

  return Math.round(finalScore);
};
