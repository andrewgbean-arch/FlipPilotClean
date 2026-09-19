// Under this much once sold, an item isn't worth the time, petrol and postage.
export const WORTH_SELLING_MIN = 10;

export function buildFlipMeta(market: any) {
  // Use the averaged sell estimate, not the raw highest price found — a
  // single expensive outlier in a noisy search shouldn't inflate profit.
  const sellEstimate = market?.average ?? market?.googlePriceMax;
  const profit =
    sellEstimate && market?.smartPrice
      ? sellEstimate - market.smartPrice
      : 0;

  let flipScore = 40;

  if (profit > 1) flipScore += 20;
  if (profit > 3) flipScore += 20;
  if (profit > 5) flipScore += 10;

  if (market?.soldCount > 5) flipScore += 10;
  if (market?.soldCount === 0) flipScore -= 10;

  // Under £10 to resell is not worth a punt, however good the margin looks.
  const notWorthIt = sellEstimate != null && sellEstimate < WORTH_SELLING_MIN;
  if (notWorthIt) flipScore = Math.min(flipScore, 35);

  return {
    flipScore,
    flipPotential:
      flipScore >= 80 ? "High" : flipScore >= 60 ? "Medium" : "Low",
    sellSpeed:
      market?.soldCount > 5
        ? "Fast"
        : market?.soldCount > 0
        ? "Normal"
        : "Slow",
    rarity: "Common",
    insights: notWorthIt
      ? "Under £10 once sold, so probably not worth the trip."
      : "Based on current retail and used prices, this item has moderate flip potential.",
    predictedProfit: profit,
  };
}
