export type MarketValuation = {
  estimatedPrice: number;
  tradeInPrice: number;
  privateSalePrice: number;
  confidence: number;

  // Intelligence upgrades
  status: "undervalued" | "fair" | "overpriced";
  recommendedSalePrice: number;
  marketTrend: number; // 0–100
  demandLevel: number; // 0–100
};

export function estimateMarketValue({
  make,
  model,
  year,
  mileage,
  purchasePrice,
  condition,
  motExpiry,
}: {
  make: string;
  model: string;
  year: number;
  mileage: number;
  purchasePrice: number;
  condition: "excellent" | "good" | "average" | "poor";
  motExpiry?: string | null;
}): MarketValuation {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  // ⭐ Base price starts from purchase price (flips are bought cheap)
  let base = purchasePrice;

  // ⭐ Age curve (newer cars hold value better)
  const agePenalty = age * 250;
  base -= agePenalty;

  // ⭐ Mileage curve (steeper drop after 120k)
  const mileagePenalty =
    mileage < 60000
      ? mileage * 0.05
      : mileage < 120000
      ? mileage * 0.08
      : mileage * 0.12;

  base -= mileagePenalty;

  // ⭐ Condition multiplier
  const conditionMultiplier = {
    excellent: 1.2,
    good: 1.05,
    average: 0.9,
    poor: 0.75,
  }[condition];

  base *= conditionMultiplier;

  // ⭐ MOT multiplier
  let motMultiplier = 1;
  if (motExpiry) {
    const expiryDate = new Date(motExpiry);
    const now = new Date();
    if (expiryDate < now) motMultiplier = 0.85; // expired MOT hurts value
    else if (expiryDate.getTime() - now.getTime() < 1000 * 60 * 60 * 24 * 60)
      motMultiplier = 0.95; // MOT expiring soon
  }
  base *= motMultiplier;

  // ⭐ Brand desirability multiplier
  const desirableBrands = ["BMW", "Audi", "Mercedes", "Volkswagen", "Ford"];
  const brandMultiplier = desirableBrands.includes(make) ? 1.1 : 1;
  base *= brandMultiplier;

  // ⭐ Seasonal demand multiplier (summer boosts convertibles, winter boosts 4x4)
  const month = new Date().getMonth() + 1;
  let seasonalMultiplier = 1;

  if (["MX-5", "Z4", "SLK"].includes(model) && month >= 4 && month <= 8)
    seasonalMultiplier = 1.15;

  if (["Q7", "X5", "Range Rover"].includes(model) && month >= 10)
    seasonalMultiplier = 1.1;

  base *= seasonalMultiplier;

  // ⭐ Final prices
  const privateSalePrice = Math.round(base);
  const tradeInPrice = Math.round(base * 0.85);
  const estimatedPrice = Math.round((privateSalePrice + tradeInPrice) / 2);

  // ⭐ Market trend (0–100)
  const marketTrend =
    100 -
    age * 2 -
    (mileage > 120000 ? 10 : 0) +
    (condition === "excellent" ? 10 : 0);

  // ⭐ Demand level (0–100)
  const demandLevel =
    (brandMultiplier - 1) * 100 +
    (seasonalMultiplier - 1) * 100 +
    (conditionMultiplier - 1) * 100;

  // ⭐ Confidence score
  const confidence =
    Math.max(40, 100 - age * 2 - (mileage > 150000 ? 10 : 0));

  // ⭐ Status detection
  let status: "undervalued" | "fair" | "overpriced" = "fair";

  if (estimatedPrice > purchasePrice * 1.25) status = "undervalued";
  if (estimatedPrice < purchasePrice * 0.85) status = "overpriced";

  // ⭐ Recommended sale price
  const recommendedSalePrice = Math.round(
    privateSalePrice * (1 + demandLevel / 300)
  );

  return {
    estimatedPrice,
    tradeInPrice,
    privateSalePrice,
    confidence,
    status,
    recommendedSalePrice,
    marketTrend: Math.min(100, Math.max(0, Math.round(marketTrend))),
    demandLevel: Math.min(100, Math.max(0, Math.round(demandLevel))),
  };
}
