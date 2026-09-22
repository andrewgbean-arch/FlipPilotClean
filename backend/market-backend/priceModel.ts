/* --------------------------------------------------
   ⭐ Price model: what it costs new, what it should sell for, what to pay

   Three prices, worked out from the evidence we have:

   NEW    the shelf price of one unit. Evidence: Amazon, Google Shopping, and the
          AI's knowledge of UK prices. Multipacks and adverts only ever push a
          listed price UP, so when the sources disagree wildly the ones that
          look contaminated are set aside.
   SELL   what it should resell for. Used items: worked out from the NEW price
          (a used one sells for a share of it, by CONDITION and AGE — see below),
          and checked against what similar used ones ask on eBay and the AI's used
          range: the middle of those opinions wins. A "Not working" item skips that
          check (it is priced for spares/repair, not a working sale) and a broken
          item found on eBay would only mislead it. Sealed/new items: at or a
          little under the shelf price. Never more than it costs new.
   BUY    the most worth paying: half the sell price, which leaves room for
          fees, postage and a profit.

   Kept as a pure function of its inputs so it can be checked on its own.
-------------------------------------------------- */

// Physical/functional state, asked as its own question on the scan result — an
// AI guess from one photo is often too generic to price well on its own.
export type Grade = "perfect" | "good" | "poor" | "not-working";

// How long it's been owned/used, asked separately from condition: a "Perfect"
// item bought last week is worth more than an equally "Perfect" one that's a
// year old — newer tech and fashion depreciate fastest, even unmarked.
export type AgeBand = "new" | "like-new" | "within-6-months" | "over-1-year";

/**
 * What a used item sells for as a share of the new price, by condition. These
 * are rules of thumb, not measurements. "Not working" is priced for spares or
 * repair, not a working sale — see NOT_WORKING_SHARE below, used in place of this
 * for that grade rather than as part of the usual working-item comparison.
 */
export const CONDITION_SHARE: Record<Grade, number> = {
  perfect: 0.7,
  good: 0.5,
  poor: 0.3,
  "not-working": 0.12,
};

/** Convenience alias for the "not working" share, used directly in a couple of places. */
export const NOT_WORKING_SHARE = CONDITION_SHARE["not-working"];

/**
 * Extra discount for age, on top of condition — multiplied together. A recently
 * bought item holds more of its value even in the same physical condition.
 */
export const AGE_FACTOR: Record<AgeBand, number> = {
  new: 1,
  "like-new": 0.95,
  "within-6-months": 0.85,
  "over-1-year": 0.65,
};

export interface PriceEvidence {
  /** The scanned item is second-hand (true) or sealed / new (false). */
  used: boolean;
  /** Condition, for a used item. Defaults to "good" when not given. */
  grade?: Grade;
  /** How long it's been owned, for a used item. Defaults to "within-6-months". */
  age?: AgeBand;
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
    const grade = e.grade ?? "good";
    const conditionShare = CONDITION_SHARE[grade];
    // Age doesn't further discount an item that's already priced for spares/repair.
    const ageFactor = grade === "not-working" ? 1 : AGE_FACTOR[e.age ?? "within-6-months"];
    const fromNew = newPrice ? newPrice * conditionShare * ageFactor : null;

    if (grade === "not-working") {
      // Priced for spares or repair, not a working sale — the market and AI
      // opinions below assume a working item, so a broken one found among them
      // would only mislead this. Fall back to the market only if there is no
      // new price to work from at all.
      sell = fromNew ?? (valid(e.ebay) ? e.ebay * NOT_WORKING_SHARE : null);
    } else {
      // Three ways to reach a used price: what used listings ask, what the new
      // price implies for this condition and age, and what the AI expects. The
      // middle opinion wins, so one bad source (used listings polluted with new
      // ones, a wrong AI guess) can't run away with it.
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
