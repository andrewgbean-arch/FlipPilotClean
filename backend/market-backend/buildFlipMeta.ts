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
    insights:
      "Based on current retail and used prices, this item has moderate flip potential.",
    predictedProfit: profit,
  };
}
