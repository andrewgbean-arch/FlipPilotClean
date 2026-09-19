/* --------------------------------------------------
   ⭐ Price model: what it costs new, what it should sell for, what to pay

   Three prices, worked out from the evidence we have:

   NEW    the shelf price of one unit. Evidence: Amazon, Google Shopping, and the
          AI's knowledge of UK prices. Multipacks and adverts only ever push a
          listed price UP, so when the sources disagree wildly the ones that
          look contaminated are set aside.
   SELL   what it should resell for. Used items: what similar used ones ask on
          eBay, cross-checked against the AI's used range. Sealed/new items:
          at or a little under the shelf price. Never more than it costs new.
   BUY    the most worth paying: half the sell price, which leaves room for
          fees, postage and a profit.

   Kept as a pure function of its inputs so it can be checked on its own.
-------------------------------------------------- */

export interface PriceEvidence {
  /** The scanned item is second-hand (true) or sealed / new (false). */
  used: boolean;
  /** Middle asking price of matching eBay listings, already scaled to the pack size. */
  ebay: number | null;
  /** Amazon's shelf price for the item. */
  amazonNew: number | null;
  /** Google Shopping's shelf price for the item. */
  googleNew: number | null;
  /** The AI's idea of the price of one new unit. */
  aiNew: number | null;
  /** The AI's idea of the second-hand range. */
  aiUsedMin: number | null;
  aiUsedMax: number | null;
}

export interface PriceDecision {
  newPrice: number | null;
  sell: number | null;
  buy: number | null;
}

/** The share of the sell price worth paying. */
export const BUY_SHARE = 0.5;

const valid = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

const round2 = (n: number) => Number(n.toFixed(2));

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Two prices "agree" when neither is more than twice the other.
const agree = (a: number, b: number) => Math.max(a, b) / Math.min(a, b) <= 2;

export function decidePrices(e: PriceEvidence): PriceDecision {
  /* ---- NEW ---- */
  const shelf = [e.amazonNew, e.googleNew].filter(valid);
  let newPrice: number | null = null;

  if (valid(e.aiNew) && shelf.length) {
    const dataLow = Math.min(...shelf);
    if (shelf.length === 2 && agree(shelf[0], shelf[1])) {
      // Three opinions: the middle one wins.
      newPrice = median([e.aiNew, ...shelf]);
    } else if (agree(e.aiNew, dataLow)) {
      newPrice = (e.aiNew + dataLow) / 2;
    } else if (dataLow > e.aiNew) {
      // Far ABOVE the AI: search results for cheap things are full of multipacks
      // and premium sellers, which only ever push a price up. Trust the AI.
      newPrice = e.aiNew;
    } else {
      // Far BELOW the AI: a listing can't easily be cheaper than the shelf
      // price by accident, but a bulk discount can make it look so. Land between.
      newPrice = Math.sqrt(e.aiNew * dataLow);
    }
  } else if (valid(e.aiNew)) {
    newPrice = e.aiNew;
  } else if (shelf.length) {
    newPrice = Math.min(...shelf);
  }

  /* ---- SELL ---- */
  let sell: number | null = null;
  const aiUsedMid =
    valid(e.aiUsedMin) && valid(e.aiUsedMax)
      ? (e.aiUsedMin + e.aiUsedMax) / 2
      : valid(e.aiUsedMax)
      ? e.aiUsedMax
      : null;

  if (e.used) {
    if (valid(e.ebay) && aiUsedMid) {
      // Trust the market unless it is wildly off what the AI expects.
      sell = agree(e.ebay, aiUsedMid) ? e.ebay : aiUsedMid;
    } else {
      sell = valid(e.ebay) ? e.ebay : aiUsedMid;
    }
    if (sell === null && newPrice) sell = newPrice * 0.4;
    if (sell !== null && newPrice) sell = Math.min(sell, newPrice * 0.9);
  } else {
    if (valid(e.ebay) && !(newPrice && e.ebay > newPrice * 1.5)) {
      sell = e.ebay;
    } else if (newPrice) {
      sell = newPrice * 0.9;
    } else {
      sell = valid(e.ebay) ? e.ebay : null;
    }
    // Sealed goods resell at or under the shelf price, not over it.
    if (sell !== null && newPrice) sell = Math.min(sell, newPrice * 0.95);
  }

  return {
    newPrice: newPrice === null ? null : round2(newPrice),
    sell: sell === null ? null : round2(sell),
    buy: sell === null ? null : round2(sell * BUY_SHARE),
  };
}
