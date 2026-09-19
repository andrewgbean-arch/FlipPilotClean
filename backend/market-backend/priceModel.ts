/* --------------------------------------------------
   ⭐ Price model: what it costs new, what it should sell for, what to pay

   Three prices, worked out from the evidence we have:

   NEW    the shelf price of one unit. Evidence: Amazon, Google Shopping, and the
          AI's knowledge of UK prices. Multipacks and adverts only ever push a
          listed price UP, so when the sources disagree wildly the ones that
          look contaminated are set aside.
   SELL   what it should resell for. Used items: worked out from the NEW price
          (a used one in good condition sells for about half of it), and checked
          against what similar used ones ask on eBay and the AI's used range: the
          middle of those opinions wins. Sealed/new items: at or a little under
          the shelf price. Never more than it costs new.
   BUY    the most worth paying: half the sell price, which leaves room for
          fees, postage and a profit.

   Kept as a pure function of its inputs so it can be checked on its own.
-------------------------------------------------- */

export type Grade = "like new" | "good" | "fair" | "poor";

/**
 * What a used one sells for as a share of the new price, by condition. These
 * are rules of thumb, not measurements: electronics lose value faster than
 * furniture, and a working, tidy item in "good" condition typically goes for
 * around half of new.
 */
export const USED_SHARE: Record<Grade, number> = {
  "like new": 0.7,
  good: 0.5,
  fair: 0.35,
  poor: 0.2,
};

export interface PriceEvidence {
  /** The scanned item is second-hand (true) or sealed / new (false). */
  used: boolean;
  /** How good the used item is (used items only). Defaults to "good". */
  grade?: Grade;
  /** Middle asking price of NEW eBay listings for the same item. */
  ebayNew?: number | null;
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
  // What the shops and eBay's new listings say. With three opinions the middle
  // one wins; with two, the lower (contamination only pushes a price up).
  const shelfList = [e.amazonNew, e.googleNew, e.ebayNew].filter(valid);
  const shelf = shelfList.length ? [shelfList.length >= 3 ? median(shelfList) : Math.min(...shelfList)] : [];
  let newPrice: number | null = null;

  if (valid(e.aiNew) && shelf.length) {
    const dataLow = shelf[0];
    if (agree(e.aiNew, dataLow)) {
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
    // Three ways to reach a used price: what used listings ask, what the new
    // price implies for this condition, and what the AI expects. The middle
    // opinion wins, so one bad source (used listings polluted with new ones, a
    // wrong AI guess) can't run away with it.
    const fromNew = newPrice ? newPrice * USED_SHARE[e.grade ?? "good"] : null;
    const opinions = [e.ebay, fromNew, aiUsedMid].filter(valid);

    if (opinions.length >= 3) {
      sell = median(opinions);
    } else if (opinions.length === 2) {
      // Two opinions: use the market's if they agree, otherwise the one worked
      // out from the new price (else the lower).
      const [a, b] = opinions;
      sell = agree(a, b) ? (valid(e.ebay) ? e.ebay : (a + b) / 2) : valid(fromNew) ? fromNew : Math.min(a, b);
    } else if (opinions.length === 1) {
      sell = opinions[0];
    }
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
