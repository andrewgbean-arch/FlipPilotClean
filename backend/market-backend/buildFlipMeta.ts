// Under this much once sold, an item isn't worth the time, petrol and postage.
export const WORTH_SELLING_MIN = 10;

/**
 * The FlipScore says how far the numbers can be trusted as a flip, from what a scan really knows:
 * how many comparable live listings there were, how closely they agree, and whether the resale value
 * is worth the trip. It is NOT built from the profit, because the recommended buy price is a fixed
 * share of the sell price (see priceModel.ts), so the profit at that price is the same for every item
 * and would score them all alike.
 *
 * Nothing here knows how fast an item sells (the listings are live, not sold), so no sell speed or
 * rarity is claimed.
 */
export function buildFlipMeta(market: any) {
  const sellEstimate: number | null = market?.average ?? market?.googlePriceMax ?? null;
  const profit =
    sellEstimate && market?.smartPrice
      ? sellEstimate - market.smartPrice
      : 0;

  // Live eBay listings that were compared (the field is called soldCount for history's sake).
  const listings = Number(market?.ebay?.items?.length ?? market?.soldCount ?? 0) || 0;
  const lo = Number(market?.ebay?.lowest);
  const hi = Number(market?.ebay?.highest);
  const mid = Number(market?.ebay?.average ?? sellEstimate);
  const spread = listings >= 3 && lo > 0 && hi >= lo && mid > 0 ? (hi - lo) / mid : null;

  let flipScore = 30;
  flipScore += listings >= 10 ? 25 : listings >= 5 ? 18 : listings >= 2 ? 10 : listings === 1 ? 4 : 0;
  if (spread != null) flipScore += spread <= 0.5 ? 15 : spread <= 1 ? 8 : 0;
  if (sellEstimate != null) flipScore += sellEstimate >= 50 ? 15 : sellEstimate >= 25 ? 10 : sellEstimate >= WORTH_SELLING_MIN ? 5 : 0;

  // Under £10 to resell is not worth a punt, however well the listings agree.
  const notWorthIt = sellEstimate != null && sellEstimate < WORTH_SELLING_MIN;
  if (notWorthIt) flipScore = Math.min(flipScore, 35);
  // No resale price at all: nothing to score.
  if (sellEstimate == null) flipScore = Math.min(flipScore, 15);

  const money = (n: number) => `£${n >= 100 ? Math.round(n) : n.toFixed(2)}`;
  const insights = notWorthIt
    ? "Under £10 once sold, so probably not worth the trip."
    : sellEstimate == null
    ? "No reliable resale price was found for this one."
    : listings > 0
    ? `Based on ${listings} live eBay listing${listings === 1 ? "" : "s"}${
        Number.isFinite(lo) && Number.isFinite(hi) && hi > lo ? ` (asking ${money(lo)} to ${money(hi)})` : ""
      }. These are asking prices, not confirmed sales.`
    : "No comparable eBay listings were found, so this price is an estimate only.";

  return {
    flipScore,
    flipPotential: flipScore >= 70 ? "High" : flipScore >= 40 ? "Medium" : "Low",
    sellSpeed: null,
    rarity: null,
    insights,
    predictedProfit: profit,
  };
}
