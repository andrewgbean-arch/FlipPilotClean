/* --------------------------------------------------
   ⭐ Price model: what it costs new, what it should sell for, what to pay

   Three prices, worked out from the evidence we have:

   NEW    the shelf price of one unit. Evidence: Google Shopping, new eBay
          listings, and the AI's knowledge of UK prices. Multipacks and adverts only ever push a
          listed price UP, so when the sources disagree wildly the ones that
          look contaminated are set aside.
   SELL   what it should resell for. Used items: worked out from the NEW price
          (a used one sells for a share of it, by CONDITION and AGE — see below),
          and checked against what similar used ones ask on eBay and the AI's used
          range: the middle of those opinions wins (but never far above a solid pile
          of real used listings, see LISTINGS_CEILING). A "Not working" item skips that
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
 * How far above the plain condition-and-age estimate real market data (real listings, the AI's
 * own read of the market) is allowed to push a used price. Those real sources are trusted over
 * the simple share table when they disagree — see the "opinions" blend below — but without a
 * ceiling tied to condition, a strong signal from real (asking-price, not confirmed-sale)
 * listings could put a "Perfect" item within a few pounds of a new one, which nobody would
 * believe, or worse for a "Poor" one. The old ceiling was one flat 90% of new for every
 * condition; found live on real items (a Sony XM4 and a Nintendo Switch both priced "Perfect"
 * within 11-13% of new): fixed to scale with the condition actually chosen.
 */
export const USED_PRICE_UPLIFT_ALLOWED = 1.2;

/**
 * With at least this many real used listings behind the eBay figure, that figure is solid evidence of what a
 * used one sells for, and the used price may not go more than LISTINGS_CEILING times above it.
 *
 * Why: the "middle of three opinions" below treats the listings, the new-price rule of thumb and the AI's own
 * used range as independent. They are not: the AI's idea of the new price feeds the rule of thumb (all of it when
 * Google found no shelf price), and the AI's used range runs high for older gadgets, clothes, furniture and
 * media. Two opinions that are really one then outvote a big, agreeing pile of real listings. Found 18 Oct 2026
 * in a 100-item test of everyday second-hand items: a Galaxy S21 priced at 298 against 48 listings averaging
 * 139, a Harris Tweed jacket at 130 against 36 averaging 36, a Game of Thrones DVD box set at 27.50 against 31
 * averaging 9.72. The ceiling only ever LOWERS a price: it never lifts one, because a listing set can be
 * polluted the other way (a pair of bedside tables averaging 310) and the other opinions are right to pull down.
 * The eBay figure is already a filtered middle asking price less 10%, so 1.5x it is well above what such an item
 * typically sells for, and there is room for a Perfect, like-new one.
 */
export const LISTINGS_THAT_ANCHOR = 10;
export const LISTINGS_CEILING = 1.5;

/**
 * An AI that says it does not know the item (aiRecognised false) is guessing from the name. When the title names a specific model (namedModel: "Duotts C29", not
 * "Pine chest of drawers") and at least this many real listings stand behind the price (used eBay ones plus shop ones), its numbers are set aside and the price is
 * worked from the listings alone. The same figure as STRONG_LISTINGS in the app (evidenceDepth.ts), where fewer listings than this already show the price as a
 * rough guide.
 *
 * Found 10 Nov 2026: a typed "Duotts C29" (an e-bike of about £800 new, 11 matching shop listings) was priced at £213 because the AI, which did not know the
 * brand, put a new one at £50 and pulled the blend down, and the shop price was then lifted only as far as the cheapest listing.
 *
 * Why a model must be named: tried without that gate on 78 typed items, the rule also moved a "Pine chest of drawers" from £107 to £281 (42 eBay listings with a
 * middle asking price of £312: large and antique chests and delivery-inclusive asks) and an "Oak coffee table", a "Russell Hobbs toaster" and a "Hot Wheels track set"
 * by small amounts. The AI says it does not know those too, but only because the title names no make and model; its guess about that KIND of thing is a sound prior
 * and the listings are a mixed bag (the lesson of 18 Oct 2026 again: a floor from eBay alone made the 100-item test worse). Only used items. With fewer listings
 * the AI still takes part (the screen calls that a rough guide), and with none at all the price is withheld (see isUnrecognised in fetchMarketData.ts).
 */
export const LISTINGS_THAT_OUTWEIGH_AI_GUESS = 10;

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

/**
 * What the share table says a used item is worth when the owner has not changed the Condition or Age boxes: a "good" one bought within the last 6 months. The usual ceiling
 * (USED_PRICE_UPLIFT_ALLOWED times this share of the new price, about 51%) is the figure the evidence is measured against below.
 *
 * That ceiling is a rule of thumb (a used one sells for about half its new price, so never more than that plus 20%), and it is wrong for goods that hold their value. Found
 * 10 Nov 2026, once the AI's answer for a Brompton stopped being lost to a thousands comma: a Brompton M6L (29 used listings with a middle asking price around £877, the AI's
 * own used range £600-£900) came out at £612, a P Line (£1,800 on eBay) at £816, a Rolex Submariner (£7,667 on eBay across 38 listings, the AI says £6,000-£9,000) at £4,080, an
 * Xbox Series S at £128 (eBay £281, the AI £150-£200, a used one sells for about £170): in each the ceiling, not the evidence, set the price.
 *
 * So when at least LISTINGS_THAT_ANCHOR used listings AND the AI's own used range BOTH put a used one above the usual ceiling, the ceiling is multiplied by how far the lower of
 * the two is above it: the same factor for every Condition and Age box, so the boxes keep working and keep their order (Poor below Good below Perfect, Older below Newer). At
 * the usual boxes the ceiling becomes the lower of the two sources, never more. Why both: the lesson of 18 Oct 2026 was that eBay alone can be polluted high (a pine chest of
 * drawers: 42 listings at £312, the AI says £50-£100, so the ceiling of £127 and the price of £107 stay put), and the AI's used range alone runs high for older gadgets. Replayed
 * over 123 typed items (eBay and the AI alone) 13 prices moved and 110 did not; every move was toward the two sources and none went above the lower of them.
 */
export const USUAL_USED_SHARE = CONDITION_SHARE.good * AGE_FACTOR["within-6-months"];

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
  /** How many used listings that figure was worked out from (after the filtering). */
  ebayListings?: number | null;
  /** Google Shopping's shelf price for the item. */
  googleNew: number | null;
  /** The AI's idea of the price of one new unit. */
  aiNew: number | null;
  /** The AI's idea of the second-hand range. */
  aiUsedMin: number | null;
  aiUsedMax: number | null;
  /**
   * The cheapest real, relevant, single-unit listing actually seen (currently
   * Google Shopping's own minimum, which already went through the same
   * relevance/bulk filtering as everything else). The blended NEW price is a
   * lower-quartile-and-AI-estimate average, which can land below a real price
   * someone could point to on screen — nothing should ever look cheaper than
   * an actual listing that was found for it.
   */
  marketFloor?: number | null;
  /**
   * Whether the AI said it actually knows this make and model. false = it priced the item from how the name sounds, so its numbers are a guess and not
   * evidence (see LISTINGS_THAT_OUTWEIGH_AI_GUESS). Absent or null = it did not say, which changes nothing.
   */
  aiRecognised?: boolean | null;
  /** Whether the title names a specific model, not just a kind of thing (see namesAModel in bulkListingFilter.ts). */
  namedModel?: boolean | null;
  /** How many shop listings stand behind googleNew (after the filtering). */
  googleListings?: number | null;
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
// A real listing is priced "£135", not "£134.31" — rounds up, never down, so the recommendation
// is never showing less than what the underlying numbers actually support. Whole pounds only
// makes sense once a pound is a small step relative to the price itself: rounding a £1.20 packet
// of crisps up to a flat £2.00 would be a 67% jump, so the step this rounds to scales with size —
// 10p under £10, 50p from £10 to £50, a whole £1 above that (where "134.31" becomes "135").
const roundUpNice = (n: number) => {
  const step = n < 10 ? 0.1 : n < 50 ? 0.5 : 1;
  return round2(Math.ceil(n / step) * step);
};

// Below this, a real listing miles above the AI's guess is overwhelmingly a multipack or a
// wholesale/premium-seller listing (the exact territory bulkListingFilter.ts was built for) — at
// or above it, "the AI just doesn't know this specific thing well" becomes at least as likely.
const CHEAP_ITEM_THRESHOLD = 20;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Two prices "agree" when neither is more than twice the other.
const agree = (a: number, b: number) => Math.max(a, b) / Math.min(a, b) <= 2;

export function decidePrices(e: PriceEvidence): PriceDecision {
  // See LISTINGS_THAT_OUTWEIGH_AI_GUESS: an AI that is only guessing at a named model is not heard when real listings are plentiful.
  const aiGuessing =
    e.used &&
    e.aiRecognised === false &&
    e.namedModel === true &&
    (e.ebayListings ?? 0) + (e.googleListings ?? 0) >= LISTINGS_THAT_OUTWEIGH_AI_GUESS;
  const aiNew = aiGuessing ? null : e.aiNew;
  const aiUsedMin = aiGuessing ? null : e.aiUsedMin;
  const aiUsedMax = aiGuessing ? null : e.aiUsedMax;

  /* ---- NEW ---- */
  // What real shops charge, from Google — the source built for exactly this question. eBay's own
  // "new condition" search (e.ebayNew) deliberately plays NO part here any more: it was the
  // repeated troublemaker found live today (a Vitamix blender's new-condition search averaging
  // £16, a Herman Miller Aeron chair's averaging £25-34 — both real premium items, both eBay
  // "new" searches badly polluted by mismatched or spare-part listings even after real filtering
  // work). The owner's call: paying customers get the more reliable source driving the actual
  // price; eBay's own range is still shown, informationally, alongside it (see ebayItems/lowest/
  // highest on the response) — just no longer blended into what Buy/Sell/Profit are worked out
  // from.
  const shelfList = [e.googleNew].filter(valid);
  const shelf = shelfList.length ? [shelfList[0]] : [];
  let newPrice: number | null = null;

  if (valid(aiNew) && shelf.length) {
    const dataLow = shelf[0];
    if (agree(aiNew, dataLow)) {
      newPrice = (aiNew + dataLow) / 2;
    } else if (dataLow > aiNew) {
      // Far ABOVE the AI. For a cheap item this is almost always multipacks and premium
      // sellers pushing the price up — real listings already go through pack-size scaling
      // and bulk-listing filtering upstream (bulkListingFilter.ts), but that filter can't
      // catch everything, and a cheap item is rarely wrong about its own rough shelf price
      // by this much for any other reason, so the AI still wins outright below this.
      // Above it, a genuinely wrong AI guess — an unfamiliar model, a rare or newer
      // release, a niche product it simply doesn't know well — is at least as likely as
      // leftover multipack contamination, so land between the two instead of dismissing
      // real listings entirely (found live: a De'Longhi Rivelia espresso machine, real
      // listings around £350-535, priced at £150 because the AI alone was trusted).
      newPrice = aiNew < CHEAP_ITEM_THRESHOLD ? aiNew : Math.sqrt(aiNew * dataLow);
    } else {
      // Far BELOW the AI: a listing can't easily be cheaper than the shelf
      // price by accident, but a bulk discount can make it look so. Land between.
      newPrice = Math.sqrt(aiNew * dataLow);
    }
  } else if (valid(aiNew)) {
    newPrice = aiNew;
  } else if (shelf.length) {
    newPrice = Math.min(...shelf);
  }

  // Never end up cheaper than a real listing that was actually found for it -
  // the lower-quartile-and-AI blend above can land below that by design, but
  // showing a price under something on screen right now looks simply wrong.
  if (newPrice !== null && valid(e.marketFloor) && newPrice < e.marketFloor) {
    newPrice = e.marketFloor;
  }

  /* ---- SELL ---- */
  let sell: number | null = null;
  const aiUsedMid =
    valid(aiUsedMin) && valid(aiUsedMax)
      ? (aiUsedMin + aiUsedMax) / 2
      : valid(aiUsedMax)
      ? aiUsedMax
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

      // See LISTINGS_THAT_ANCHOR: plenty of real used listings stop the other two opinions running far above them.
      if (sell !== null && valid(e.ebay) && (e.ebayListings ?? 0) >= LISTINGS_THAT_ANCHOR) {
        sell = Math.min(sell, e.ebay * LISTINGS_CEILING);
      }
    }
    // A ceiling that scales with the condition (and age) actually chosen, not one flat number for
    // every grade — see USED_PRICE_UPLIFT_ALLOWED above. Scaled up, by the same factor for every condition and age, when the evidence says this item holds its value:
    // see USUAL_USED_SHARE.
    if (sell !== null && newPrice) {
      let ceiling = newPrice * conditionShare * ageFactor * USED_PRICE_UPLIFT_ALLOWED;
      if (grade !== "not-working" && valid(e.ebay) && (e.ebayListings ?? 0) >= LISTINGS_THAT_ANCHOR && valid(aiUsedMid)) {
        const usualCeiling = newPrice * USUAL_USED_SHARE * USED_PRICE_UPLIFT_ALLOWED;
        const evidence = Math.min(e.ebay, aiUsedMid);
        if (evidence > usualCeiling) ceiling *= evidence / usualCeiling;
      }
      sell = Math.min(sell, ceiling);
    }
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

  // Buy is worked out from this same rounded sell (not the raw one above), so the Buy price shown
  // and the profit shown (sell minus buy) both agree with the sell price on screen to the penny.
  const finalSell = sell === null ? null : roundUpNice(sell);

  return {
    newPrice: newPrice === null ? null : round2(newPrice),
    sell: finalSell,
    buy: finalSell === null ? null : round2(finalSell * BUY_SHARE),
  };
}
