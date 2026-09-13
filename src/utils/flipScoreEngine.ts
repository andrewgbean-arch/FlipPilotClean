/**
 * FlipPilot Mega FlipScore Engine (v3)
 * Combines:
 * - Profit margin
 * - Demand score
 * - Rarity
 * - Condition
 * - Sell speed
 * - AI confidence
 * - Mileage curve
 * - Owner penalty
 * - MOT history weighting
 * - Age penalty
 * - Market desirability
 */

export type FlipScoreInput = {
  buyPrice: number;
  sellPrice: number;

  demandScore: number; // 0–100
  rarity: "Common" | "Uncommon" | "Rare" | "Ultra Rare";
  condition: "Poor" | "Fair" | "Good" | "Excellent";
  sellSpeed: "Slow" | "Medium" | "Fast";

  aiPriceConfidence?: number; // optional 0–100

  // NEW FIELDS
  mileage?: number;
  owners?: number;
  motHistory?: { passed: boolean; advisories: number }[];
  age?: number;
  marketDesirability?: number; // 0–100
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

    mileage = 60000,
    owners = 2,
    motHistory = [],
    age = 8,
    marketDesirability = 50,
  } = input;

  // -----------------------------------------
  // 1. PROFIT SCORE (0–100)
  // -----------------------------------------
  const profit = sellPrice - buyPrice;
  const profitMargin = profit <= 0 ? 0 : Math.min((profit / buyPrice) * 100, 100);

  // -----------------------------------------
  // 2. RARITY SCORE
  // -----------------------------------------
  const rarityMap = {
    Common: 20,
    Uncommon: 40,
    Rare: 70,
    "Ultra Rare": 90,
  };
  const rarityScore = rarityMap[rarity] ?? 30;

  // -----------------------------------------
  // 3. CONDITION SCORE
  // -----------------------------------------
  const conditionMap = {
    Poor: 20,
    Fair: 40,
    Good: 70,
    Excellent: 90,
  };
  const conditionScore = conditionMap[condition] ?? 50;

  // -----------------------------------------
  // 4. SELL SPEED SCORE
  // -----------------------------------------
  const speedMap = {
    Slow: 30,
    Medium: 60,
    Fast: 90,
  };
  const sellSpeedScore = speedMap[sellSpeed] ?? 50;

  // -----------------------------------------
  // 5. AI CONFIDENCE
  // -----------------------------------------
  const aiScore = aiPriceConfidence;

  // -----------------------------------------
  // 6. MILEAGE CURVE (penalty)
  // -----------------------------------------
  const mileagePenalty = Math.min(40, Math.log(mileage / 5000) * 10);

  // -----------------------------------------
  // 7. OWNER PENALTY
  // -----------------------------------------
  const ownerPenalty = owners > 3 ? (owners - 3) * 5 : 0;

  // -----------------------------------------
  // 8. MOT HISTORY PENALTY
  // -----------------------------------------
  const motPenalty = motHistory.reduce((acc, m) => {
    if (!m.passed) acc += 15;
    acc += m.advisories * 2;
    return acc;
  }, 0);

  // -----------------------------------------
  // 9. AGE PENALTY
  // -----------------------------------------
  const agePenalty = age > 10 ? (age - 10) * 2 : 0;

  // -----------------------------------------
  // 10. MARKET DESIRABILITY BOOST
  // -----------------------------------------
  const desirabilityBoost = marketDesirability * 0.3;

  // -----------------------------------------
  // FINAL SCORE
  // -----------------------------------------
  const finalScore =
    profitMargin * 0.30 +
    demandScore * 0.15 +
    rarityScore * 0.10 +
    conditionScore * 0.10 +
    sellSpeedScore * 0.10 +
    aiScore * 0.05 +
    desirabilityBoost * 0.10 -
    mileagePenalty * 0.05 -
    ownerPenalty * 0.05 -
    motPenalty * 0.05 -
    agePenalty * 0.05;

  return Math.max(0, Math.min(100, Math.round(finalScore)));
};
