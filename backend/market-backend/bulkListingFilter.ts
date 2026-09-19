/* --------------------------------------------------
   ⭐ Bulk/multipack listing filter and pack-size price adjustment

   Cheap consumables (groceries, toiletries, cleaning products, nicotine
   lozenges) get their price badly skewed on eBay/Google/Amazon because search
   results mix single-unit listings with bulk lots, catering packs and
   multipacks of the same product — e.g. searching "washing up liquid" returns
   "5L", "6 x 1L", "(2Pcs) 10L", "Pack of 5" alongside genuine single bottles,
   and a plain price average has no way to tell a £6 single item from a
   £6-for-a-case-of-5 item.

   Nicotine lozenges sold at £3.49 a pack were being priced at about £15,
   because nearly every listing found was an 80-lozenge box or a multiple of
   them ("6x ... 80s - Total 480 Lozenges"). So when the pack size of the
   scanned item is known (read off the label or the barcode record):
     - a listing that says how many units it holds is scaled to the scanned
       pack ("£21.19 for 80" is about £5.30 for 20), and
     - obvious wholesale wording, or a size we can't work out, is dropped.
   When the pack size is NOT known, the old rule applies: multiplier wording
   ("pack of 5", "6 x 1L", "x12") is treated as bulk and dropped.
-------------------------------------------------- */

// Wording that means "not a single retail unit", whatever the size.
const BULK_WORDING = [
  /\bmulti[- ]?packs?\b/i,
  /\bvalue\s*packs?\b/i,
  /\bcase of\b/i,
  /\bjob\s*lot\b/i,
  /\bwholesale\b/i,
  /\bbulk\s*(buy|lot|pack)?\b/i,
  /\bbundle\b/i,
  /\blot of\b/i,
  /\bfamily\s*packs?\b/i,
  /\bsaver\s*packs?\b/i,
  /\btwin\s*packs?\b/i,
  /\btriple\s*packs?\b/i,
  /\bmega\s*packs?\b/i,
];

const X = "[x×X]"; // listings use a plain x, a capital X and the multiplication sign

// Quantity multipliers: "pack of 5", "6 x 1L", "6x Nicorette", "x12", "(2Pcs)", "3 pack".
const MULTIPLIER = [
  /\bpack of\s*(\d+)/i,
  new RegExp(`\\b(\\d+)\\s*${X}(?![a-zA-Z])`), // "6x ", "2 X(80)", "40 x Nicotine", "2×"
  new RegExp(`\\b${X}\\s?(\\d+)\\b`), //        "x12", "x 12"
  /\(\s*(\d+)\s*p(?:c|cs|iece|ieces)?\s*\)/i, // "(2Pcs)"
  /\b(\d+)\s*(?:packs?|pk)\b/i, //               "3 pack", "4pk"
];

// Words for the thing being counted. Only words that clearly mean "one of the
// thing in the box"; "Lozengse" and similar typos are common in listings.
const COUNT_STEMS =
  "lozen\\w*|tablets?|capsules?|caplets?|sachets?|pouches|pastilles?|softgels?|pcs|pieces?|" +
  "count|ct|units?|doses?|servings?|portions?|gums?|strips?|patches|tea\\s?bags?|" +
  "nappies|diapers?|swabs?|refills?|wipes?";

// "72 lozenges", "210 Gums".
const COUNT_WORD = new RegExp(`\\b(\\d{1,4})\\s?(?:${COUNT_STEMS})\\b`, "i");
// The trailing-s style: "Lozenges 80s".
const COUNT_S = /\b(\d{2,3})['’]?s\b/i;
// "40 x Nicotine Lozenges": the number in front of the x is the count.
const NX_COUNT = new RegExp(`\\b(\\d{1,4})\\s*${X}\\s*(?:[a-z0-9%.-]+\\s+){0,3}(?:${COUNT_STEMS})\\b`, "i");
// "2x80 Lozenges", "4 x 20 Tablets": the two numbers multiply.
const AXB_COUNT = new RegExp(`(\\d+)\\s*${X}\\s*(\\d+)\\s*(?:${COUNT_STEMS})\\b`, "i");
// "(4 x 40 Packs)": says how the count in front of it is made up, so it is not a further multiple.
const PACK_MAKEUP = new RegExp(`(\\d+)\\s*${X}\\s*(\\d+)`, "g");
// "Total 480 Lozenges"
const TOTAL = /\btotal\s*(?:of\s*)?(\d{1,4})\b/i;
// "2 X(80) ..." — a bracketed count, only trusted next to a multiplier.
const BRACKETED = /\(\s*(\d{2,3})\s*\)/;

// A single retail unit of a consumable is essentially never 2+ litres or 2+ kg —
// that's a catering/bulk container even when it's listed as "one" item.
const OVERSIZED_VOLUME = /\b(\d+(?:\.\d+)?)\s?(?:l|litre|litres|kg|kilograms?)\b/i;
const OVERSIZED_THRESHOLD = 2;

// A listing this many times the size of the scanned pack has a bulk discount
// so deep that scaling its price down tells us nothing useful.
const MAX_SCALE = 30;

function firstNumber(text: string, patterns: RegExp[], min: number, max: number): number | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= min && n <= max) return n;
    }
  }
  return null;
}

/** How many multiples of the item a listing sells ("6x", "pack of 3"), or null. */
function multiplierOf(title: string): number | null {
  return firstNumber(title, MULTIPLIER, 2, 1000);
}

/**
 * The total number of units a piece of text says it holds ("72 lozenges" → 72,
 * "6x ... 80s" → 480, "Total 480 Lozenges" → 480), or null when it doesn't say.
 */
function unitsOf(text: string): number | null {
  const total = text.match(TOTAL);
  if (total) return parseInt(total[1], 10);

  const mult = multiplierOf(text);
  const per =
    firstNumber(text, [COUNT_WORD, COUNT_S], 1, 1000) ??
    (mult !== null ? firstNumber(text, [BRACKETED], 2, 1000) : null);
  if (per !== null) {
    // "160 Pieces (4 x 40 Packs)": the 4 x 40 explains the 160, it doesn't multiply it.
    for (const m of text.matchAll(PACK_MAKEUP)) {
      if (parseInt(m[1], 10) * parseInt(m[2], 10) === per) return per;
    }
    return per * (mult ?? 1);
  }

  const axb = text.match(AXB_COUNT);
  if (axb) return parseInt(axb[1], 10) * parseInt(axb[2], 10);

  // "40 x Nicotine Lozenges": the 40 is itself the count.
  return firstNumber(text, [NX_COUNT], 2, 1000);
}

/** The pack size a piece of text states ("72 lozenges" → 72, "pack of 4" → 4), or null. */
export function extractPackCount(text: string | null | undefined): number | null {
  if (!text) return null;
  return unitsOf(text) ?? multiplierOf(text);
}

/** The total number of units a listing sells, or null when it doesn't say
 *  (a multiplier with no size, like "pack of 3", can't be scaled reliably). */
export function listingUnits(title: string): number | null {
  return unitsOf(title);
}

/**
 * True when a listing is not comparable to the item that was scanned and
 * should be ignored. See the note at the top for what `wantedCount` changes.
 */
export function isBulkListing(
  title: string | null | undefined,
  wantedCount?: number | null
): boolean {
  if (!title) return false;
  if (BULK_WORDING.some((re) => re.test(title))) return true;

  const volumeMatch = title.match(OVERSIZED_VOLUME);
  if (volumeMatch && parseFloat(volumeMatch[1]) >= OVERSIZED_THRESHOLD) return true;

  if (wantedCount && wantedCount >= 1) {
    const units = listingUnits(title);
    if (units !== null) return units / wantedCount > MAX_SCALE;

    // A multiplier with no stated size ("pack of 3") is a multiple of something
    // unknown: fine only when it is the same size as the scanned pack.
    const mult = multiplierOf(title);
    return mult !== null && Math.abs(mult - wantedCount) > Math.max(1, wantedCount * 0.1);
  }

  return MULTIPLIER.some((re) => re.test(title));
}

/**
 * The price to use for a listing, expressed as the scanned pack size, or null
 * when the listing should be ignored.
 *   - no pack size known: the listing's own price, unless it is bulk;
 *   - pack size known and the listing states its size: scaled to that size;
 *   - pack size known and the listing doesn't say: its own price.
 */
export function priceForPack(
  title: string | null | undefined,
  price: number,
  wantedCount?: number | null
): number | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  if (isBulkListing(title, wantedCount)) return null;

  if (wantedCount && wantedCount >= 1 && title) {
    const units = listingUnits(title);
    if (units !== null && Math.abs(units - wantedCount) > Math.max(1, wantedCount * 0.1)) {
      return Number(((price * wantedCount) / units).toFixed(2));
    }
  }

  return price;
}
