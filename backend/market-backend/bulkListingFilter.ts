/* --------------------------------------------------
   ⭐ Bulk/multipack listing filter

   Cheap consumables (groceries, toiletries, cleaning products) get their
   price badly skewed on eBay/Google Shopping because search results mix
   single-unit listings with bulk lots, catering packs, and multipacks of
   the same product — e.g. searching "washing up liquid" returns "5L",
   "6 x 1L", "(2Pcs) 10L", "Pack of 5" alongside genuine single bottles,
   and a plain price average has no way to tell a £6 single item from a
   £6-for-a-case-of-5 item. This strips the obvious bulk-listing titles
   out before stats are computed from a result set.
-------------------------------------------------- */
const BULK_PATTERNS = [
  /\bpack of\s*\d+/i,
  /\bmulti[- ]?packs?\b/i,
  /\bvalue\s*packs?\b/i,
  /\bcase of\b/i,
  /\bjob\s*lot\b/i,
  /\bwholesale\b/i,
  /\bbulk\s*(buy|lot|pack)?\b/i,
  /\bbundle\b/i,
  /\blot of\b/i,
  /\b\d+\s*x\s*\d/i, // "6 x 1L", "2 x 500ml"
  /\(\s*\d+\s*p(c|cs|iece|ieces)?\s*\)/i, // "(2Pcs)"
  // "x 12", "x12", "600ml x 12" — deliberately loose (doesn't require a
  // unit word after the number) since real listings write this quantity
  // multiplier in inconsistent ways.
  /\bx\s?\d+\b/i,
];

// A single retail unit of a consumable (drink, cleaning product, toiletry,
// snack, etc.) is essentially never 2+ litres or 2+ kg — that's a catering/
// bulk container even when it's technically listed as "one" item, so a
// price average built from these isn't comparable to the small single item
// actually scanned.
const OVERSIZED_VOLUME = /\b(\d+(?:\.\d+)?)\s?(?:l|litre|litres|kg|kilograms?)\b/i;
const OVERSIZED_THRESHOLD = 2;

export function isBulkListing(title: string | null | undefined): boolean {
  if (!title) return false;
  if (BULK_PATTERNS.some((re) => re.test(title))) return true;

  const volumeMatch = title.match(OVERSIZED_VOLUME);
  if (volumeMatch && parseFloat(volumeMatch[1]) >= OVERSIZED_THRESHOLD) return true;

  return false;
}
