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

// Wording that means "not a single retail unit", whatever the size. "Bundle" is deliberately not
// here: for electronics it overwhelmingly means one retail SKU sold with its official accessories
// ("PS5 Console Bundle"), not a wholesale lot — a genuinely wholesale one is still caught by
// "job lot", "wholesale", "bulk buy/lot/pack" or one of the others below.
const BULK_WORDING = [
  /\bmulti[- ]?packs?\b/i,
  /\bvalue\s*packs?\b/i,
  /\bcase of\b/i,
  /\bjob\s*lot\b/i,
  /\bwholesale\b/i,
  /\bbulk\s*(buy|lot|pack)?\b/i,
  /\blot of\b/i,
  /\bfamily\s*packs?\b/i,
  /\bsaver\s*packs?\b/i,
  /\btwin\s*packs?\b/i,
  /\btriple\s*packs?\b/i,
  /\bmega\s*packs?\b/i,
];

const X = "[x×X]"; // listings use a plain x, a capital X and the multiplication sign

// A genuine "6x"/"2 x" multiplier is followed by nothing significant, a product name (letters), or —
// when it states a size — a volume/weight/count unit ("2 x 500ml", "4 x 40 Tablets"). It is never
// followed by another bare number (at most with a LENGTH unit) — that is a physical dimension or a
// clothing size ("34x32", "120 x 60cm", "30 x 20 x 10cm"), not a multipack. Checked against whatever
// comes after a candidate "Nx" match before it is trusted.
const LENGTH_UNIT = "cm|mm|m|in|inch(?:es)?|[\"″]";
function looksLikeDimensionTail(tail: string, countStems: string): boolean {
  const m = tail.match(new RegExp(`^\\s*(\\d+(?:\\.\\d+)?)(?:\\s*(?:${LENGTH_UNIT}))?\\b`, "i"));
  if (!m) return false; // no second bare number right away (or it's glued to a non-length unit like "ml") — not a dimension
  const after = tail.slice(m[0].length);
  return !new RegExp(`^\\s*(?:${countStems})\\b`, "i").test(after);
}

// Quantity multipliers: "pack of 5", "6 x 1L", "6x Nicorette", "x12", "(2Pcs)", "3 pack".
const X_MULTIPLIER = [
  new RegExp(`\\b(\\d+)\\s*${X}(?![a-zA-Z])`, "gi"), // "6x ", "2 X(80)", "40 x Nicotine", "2×"
  new RegExp(`\\b${X}\\s?(\\d+)\\b`, "gi"), //        "x12", "x 12"
];
const NON_X_MULTIPLIER = [
  /\bpack of\s*(\d+)/i,
  /\(\s*(\d+)\s*p(?:c|cs|iece|ieces)?\s*\)/i, // "(2Pcs)"
  /\b(\d+)\s*(?:packs?|pk)\b/i, //               "3 pack", "4pk"
];

// Words for the thing being counted. Only words that clearly mean "one of the
// thing in the box"; "Lozengse" and similar typos are common in listings.
const COUNT_STEMS =
  "lozen\\w*|tablets?|capsules?|caplets?|sachets?|pouches|pastilles?|softgels?|pcs|pieces?|" +
  "count|units?|doses?|servings?|portions?|gums?|strips?|patches|tea\\s?bags?|" +
  "nappies|diapers?|swabs?|refills?|wipes?";
// "ct" on its own means "count" ("80ct"), but is exactly how gold purity is written ("9ct", "18ct
// gold") — kept apart so it can be excluded specifically when it's plainly a carat mark, not merged
// into COUNT_STEMS where every use would be trusted equally.
const COUNT_STEMS_WITH_CT = `${COUNT_STEMS}|ct`;
// "pack"/"packs" belongs ONLY to the dimension guard below, never to COUNT_STEMS itself: it once
// lived there (to stop "6 X3 Packs" reading as a dimension like "34x32"), but COUNT_STEMS also
// feeds COUNT_WORD ("N <stem>" = a stated total count) — with "pack" in it, COUNT_WORD started
// matching "6 Pack" as if it meant "6 units", on top of the SAME "6 Pack" already being read as a
// x6 multiplier elsewhere, squaring a real 6-pack into 36 (found live: a genuine Sainsbury's Old
// Spice 6-pack priced as if it were a 36-pack). "Pack" is a container word, not a unit-of-the-thing
// word like "lozenge" or "tablet", so it must never reach COUNT_WORD.
const DIMENSION_GUARD_STEMS = `${COUNT_STEMS_WITH_CT}|packs?`;
const HAS_COUNT_STEM = new RegExp(`\\b(?:${COUNT_STEMS})\\b`, "i");

// "9ct gold", "18ct white gold": a carat mark. Stripped before any count/multiplier check runs, so
// it can never be misread as "9 count" — an actual pack rarely if ever states its size as "Nct" this
// way, and even a mis-strip here just means the pack size falls back to "not stated", not a wrong one.
const GOLD_CARAT = /\b\d{1,2}\s?ct\b(?=\s*(?:yellow|white|rose)?\s*gold\b)/gi;
const dropCaratMarks = (text: string) => text.replace(GOLD_CARAT, "");

// "72 lozenges", "210 Gums", "80ct" (but not "9ct gold" — see dropCaratMarks above).
const COUNT_WORD = new RegExp(`\\b(\\d{1,4})\\s?(?:${COUNT_STEMS_WITH_CT})\\b`, "i");
// The trailing-s style: "Lozenges 80s" — only trusted when a real count-stem word is ALSO somewhere
// in the text; bare "NNs" alone is just as often a style number ("Levi's 501s") or a decade ("80s").
const COUNT_S = /\b(\d{2,3})['’]?s\b/i;
// "40 x Nicotine Lozenges": the number in front of the x is the count.
const NX_COUNT = new RegExp(`\\b(\\d{1,4})\\s*${X}\\s*(?:[a-z0-9%.-]+\\s+){0,3}(?:${COUNT_STEMS_WITH_CT})\\b`, "i");
// "2x80 Lozenges", "4 x 20 Tablets": the two numbers multiply.
const AXB_COUNT = new RegExp(`(\\d+)\\s*${X}\\s*(\\d+)\\s*(?:${COUNT_STEMS_WITH_CT})\\b`, "i");
// "(4 x 40 Packs)": says how the count in front of it is made up, so it is not a further multiple.
const PACK_MAKEUP = new RegExp(`(\\d+)\\s*${X}\\s*(\\d+)`, "g");
// "Total 480 Lozenges"
const TOTAL = /\btotal\s*(?:of\s*)?(\d{1,4})\b/i;
// "2 X(80) ..." — a bracketed count, only trusted next to a multiplier.
const BRACKETED = /\(\s*(\d{2,3})\s*\)/;

// A single retail unit of a consumable is essentially never 2+ litres or 2+ kg — that's a
// catering/bulk container even when it's listed as "one" item. But a scan for something that is
// itself naturally that size (a 5.2L air fryer, a 3kg dumbbell) must not have its own genuine match
// thrown out on the same rule — see the `ownSize` parameter on isBulkListing/priceForPack below.
const OVERSIZED_VOLUME = /\b(\d+(?:\.\d+)?)\s?(?:l|litre|litres|kg|kilograms?)\b/i;
const OVERSIZED_THRESHOLD = 2;

// Appliances and other durable goods where a stated kg/l is a completely normal single-unit
// spec (load capacity, internal volume, weight) and never a sign of a bulk/catering container.
// `ownVolume` above can't protect these the way it protects a labelled air fryer or dumbbell:
// the photo-identify step only states a scanned item's own size when it's printed on the
// OUTSIDE (see extractVolume), and an appliance's capacity is on an internal rating plate, never
// visible in a photo — real Hotpoint/Bosch/etc tumble dryer and washing machine listings that
// state their genuine 7-9kg load size were being dropped as "bulk" wholesale, on every single
// one, leaving only mismatched or spares listings to price the whole appliance from.
const CAPACITY_RATED_GOODS =
  /\b(tumble dryer|washing machine|dishwasher|fridge|freezer|refrigerator|dryer|cooker|oven|dumbbell|kettlebell|weight plate|barbell|gas bottle|gas cylinder|generator|water tank|fish tank|aquarium|suitcase|holdall|rucksack|backpack)\b/i;

/** Whether the SCANNED item (by its own query/title) is one of these — the caller passes this
 *  through to isBulkListing/priceForPack so the oversized-volume rule is skipped for it entirely. */
export function isCapacityRatedGoods(query: string | null | undefined): boolean {
  return !!query && CAPACITY_RATED_GOODS.test(query);
}

// Chairs and similar seating: found live searching "Herman Miller Aeron Chair" — every "new
// condition" eBay listing was a spare part (a headrest, a gas cylinder, a lumbar pad, arm pads,
// seat foam, touch-up paint), none caught by NOT_THE_ITEM, dragging the whole chair's own new
// price down to a few pounds. Unlike the appliance-parts words above, several of these are
// completely ordinary things to mention on a WHOLE chair's own listing ("with lumbar support",
// "smooth-rolling casters", "adjustable arm pads" are selling points, not spare-part listings),
// so — same as APPLIANCE_PARTS_EXTRA — they're only checked when the scanned item is genuinely
// seating, never added to the list every product gets checked against.
const SEATING_GOODS = /\b(chair|armchair|recliner|stool|bench|sofa|settee|couch)\b/i;
export function isSeatingGoods(query: string | null | undefined): boolean {
  return !!query && SEATING_GOODS.test(query);
}
const SEATING_PARTS_EXTRA =
  /\b(headrest|head\s?rest|gas cylinder|gas lift|lumbar(?:\s+\w+){0,3}\s+(?:pad|cushion)|arm\s?pads?|armrest pads?|foam|cushion|wheel|wheels|castors?|casters?|touch[\s-]?up|spray paint)\b/gi;

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

/** How many multiples of the item a listing sells ("6x", "pack of 3"), or null — never a physical
 *  dimension or clothing size ("34x32", "120 x 60cm") mistaken for one. */
function multiplierOf(title: string): number | null {
  for (const re of X_MULTIPLIER) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(title))) {
      const n = parseInt(m[1], 10);
      const head = title.slice(0, m.index);
      const tail = title.slice(m.index + m[0].length);
      // A bare number right before this "x" ("30 x 20 x 10cm") means this "x" is the middle of an
      // N x M x P dimension chain, not a standalone "xN" multiplier — already judged by the earlier
      // "N x" pairing, so it must not be re-approved here just because THIS number's own tail
      // happens to be another "x" rather than a bare digit.
      const precededByNumber = /\d\s*$/.test(head);
      if (n >= 2 && n <= 1000 && !precededByNumber && !looksLikeDimensionTail(tail, DIMENSION_GUARD_STEMS)) return n;
    }
  }
  return firstNumber(title, NON_X_MULTIPLIER, 2, 1000);
}

/**
 * The total number of units a piece of text says it holds ("72 lozenges" → 72,
 * "6x ... 80s" → 480, "Total 480 Lozenges" → 480), or null when it doesn't say.
 */
function unitsOf(rawText: string): number | null {
  const text = dropCaratMarks(rawText);
  const total = text.match(TOTAL);
  if (total) return parseInt(total[1], 10);

  const mult = multiplierOf(text);
  const per =
    firstNumber(text, [COUNT_WORD], 1, 1000) ??
    // "Lozenges 80s": only trusted when a real count-stem word is somewhere in the text too —
    // bare "NNs" alone is just as often a style number ("501s") or a decade ("80s").
    (HAS_COUNT_STEM.test(text) ? firstNumber(text, [COUNT_S], 1, 1000) : null) ??
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
  return unitsOf(text) ?? multiplierOf(dropCaratMarks(text));
}

/** The total number of units a listing sells, or null when it doesn't say
 *  (a multiplier with no size, like "pack of 3", can't be scaled reliably). */
export function listingUnits(title: string): number | null {
  return unitsOf(title);
}

/** The volume or weight (litres or kg) a piece of text itself states, if any — so a listing for
 *  something the SCANNED item is genuinely this size is never called bulk on that alone. */
export function extractVolume(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(OVERSIZED_VOLUME);
  return m ? parseFloat(m[1]) : null;
}

// Listings for something that goes WITH the item, or for a broken one, are not
// the item: a "JBL Charge 4 case" or "JBL Charge 4 for parts" says nothing about
// what a working speaker is worth, but it matches the search and drags the price down.
// A large appliance's own spares (a motor, a control board, a drum bearing) are the same
// problem in different words: a search for "Hotpoint Tumble Dryer" with no model number found
// eBay's whole first page of results was every one of these, none caught by the words above —
// they name a component, not an accessory, and none of the words below were on the list.
const NOT_THE_ITEM =
  /\b(case|cover|pouch|sleeve|skin|strap|lanyard|stand|mount|holder|bracket|cable|charger|charging|adapter|adaptor|battery|batteries|replacement|spare|spares|parts|repair|faulty|broken|damaged|untested|manual|sticker|decal|box only|empty box|not working|no power|dead|clip|hook|chuck|bits|brushes|gasket|nozzle|tank|filter|filters|descaler|descaling|valve|seal|seals|pipe|hose|jug|carafe|portafilter|group\s?head|3d model|3d render|digital model|cad model|stl file|render pack|motor|control board|circuit board|pcb|module|drum bearing|bearing|heater element|heating element|condenser unit|condenser box|drive belt|thermostat|capacitor|carbon brush|hinge|door|interlock|control panel)\b/gi;

// More appliance-specific spares — deliberately kept OUT of the list above and only checked when
// capacityRatedGoods says this really is a tumble dryer/fridge/etc: a "switch", "handle",
// "container" or "timer" is a completely ordinary, positive thing to mention on countless
// unrelated whole items (a games "switch" console, a suitcase "handle", a lunch "container"), so
// blacklisting them for every product would do more harm than good — but for THIS category they
// only ever name a spare part (found live: several more real spare listings this narrowly missed).
const APPLIANCE_PARTS_EXTRA = /\b(water container|drawer|pump|micro switch|switch|heat exchanger?|timer|handle|container)\b/gi;

/**
 * True when a listing looks like an accessory, spare part or faulty unit rather than the item
 * searched for. A word the search itself contains does not count (searching "phone charger" must
 * keep listings that say "charger"). `capacityRatedGoods`/`seatingGoods` (see isCapacityRatedGoods/
 * isSeatingGoods above) also check narrower, category-only vocabulary that would be too broad for
 * every product.
 */
export function isNotTheItem(
  title: string | null | undefined,
  query: string,
  capacityRatedGoods?: boolean,
  seatingGoods?: boolean
): boolean {
  if (!title) return false;
  const wanted = query.toLowerCase();
  const found = [
    ...(title.match(NOT_THE_ITEM) ?? []),
    ...(capacityRatedGoods ? title.match(APPLIANCE_PARTS_EXTRA) ?? [] : []),
    ...(seatingGoods ? title.match(SEATING_PARTS_EXTRA) ?? [] : []),
  ];
  if (!found.length) return false;
  return found.some((word) => !wanted.includes(word.toLowerCase()));
}

/**
 * True when a listing is not comparable to the item that was scanned and should be ignored. See the
 * note at the top for what `wantedCount` changes. `ownVolume` is the litres/kg the SCANNED item's own
 * title states, if any — so a real 5.2L air fryer's own listings aren't thrown out by the same rule
 * that (rightly) drops a 5L catering tub of washing-up liquid for a scan of a small bottle of it.
 * `capacityRatedGoods` skips that same rule outright for a tumble dryer, fridge or similar, where
 * `ownVolume` alone can't help (see isCapacityRatedGoods above).
 */
export function isBulkListing(
  title: string | null | undefined,
  wantedCount?: number | null,
  ownVolume?: number | null,
  capacityRatedGoods?: boolean
): boolean {
  if (!title) return false;
  if (BULK_WORDING.some((re) => re.test(title))) return true;

  if (!capacityRatedGoods) {
    const volumeMatch = title.match(OVERSIZED_VOLUME);
    if (volumeMatch) {
      const listingVolume = parseFloat(volumeMatch[1]);
      const allowed = ownVolume && ownVolume >= OVERSIZED_THRESHOLD ? ownVolume * 1.5 : OVERSIZED_THRESHOLD;
      if (listingVolume >= allowed) return true;
    }
  }

  if (wantedCount && wantedCount >= 1) {
    const units = listingUnits(title);
    if (units !== null) return units / wantedCount > MAX_SCALE;

    // A multiplier with no stated size ("pack of 3") is a multiple of something
    // unknown: fine only when it is the same size as the scanned pack.
    const mult = multiplierOf(title);
    return mult !== null && Math.abs(mult - wantedCount) > Math.max(1, wantedCount * 0.1);
  }

  return multiplierOf(title) !== null;
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
  wantedCount?: number | null,
  ownVolume?: number | null,
  capacityRatedGoods?: boolean
): number | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  if (isBulkListing(title, wantedCount, ownVolume, capacityRatedGoods)) return null;

  if (wantedCount && wantedCount >= 1 && title) {
    const units = listingUnits(title);
    if (units !== null && Math.abs(units - wantedCount) > Math.max(1, wantedCount * 0.1)) {
      return Number(((price * wantedCount) / units).toFixed(2));
    }
  }

  return price;
}

/* --------------------------------------------------
   Relevance: is this listing for the same product?

   A search for "JBL Charge 4" also returns the Charge 5, the Xtreme 4 and the
   Clip 4, and a search for one flavour of crisps returns the other flavours.
   Their prices say nothing about the scanned item. The words that identify the
   product (brand, model, flavour, size) must appear in the listing's title;
   words that only describe the kind of thing it is ("portable", "speaker") do not.
-------------------------------------------------- */
const GENERIC_WORDS = new Set(
  (
    "the a an and or for with of in on to by from new used pack set kit lot item items " +
    "black white blue red green grey gray silver gold pink purple orange yellow brown " +
    "bluetooth wireless portable speaker speakers headphones earphones earbuds console phone mobile " +
    "laptop tablet camera watch toy toys game games mini large small medium big original classic " +
    "edition genuine official uk free delivery fast bargain boxed unboxed sealed working tested " +
    "great good condition quality high low super mega ultra pro plus max lozenge lozenges tablets tablet " +
    "snacks snack crisps flavour flavor flavoured size sized " +
    // Category words for appliances: what a listing calls the kind of thing varies a lot more than
    // for electronics ("espresso machine" and "bean-to-cup coffee machine" are the same product),
    // so treating them as identity-bearing was rejecting a real Rivelia listing for saying "coffee
    // machine" instead of "espresso machine", the SAME product a genuine match was thrown out for.
    "machine machines maker makers coffee espresso automatic manual cup"
  ).split(" ")
);

function words(text: string): string[] {
  return text
    .toLowerCase()
    // "72 g" and "72g" are the same thing
    .replace(/(\d)\s+(g|kg|ml|l|mg|cm|mm|gb|tb|w|cl)\b/g, "$1$2")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 || /\d/.test(w));
}

function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  // plurals/endings (lozenge/lozenges) and a brand particle glued on the
  // front ("DeLonghi" vs "Longhi" when a listing drops the apostrophe or
  // space the query's own title has) - checked both ways round.
  return a.startsWith(b) || b.startsWith(a) || a.endsWith(b) || b.endsWith(a);
}

/** The words in a search that identify the product. Empty when the search is generic. */
export function identifyingWords(query: string): string[] {
  return Array.from(new Set(words(query).filter((w) => !GENERIC_WORDS.has(w))));
}

/** True when a listing title contains (nearly) all of the search's identifying words. */
export function matchesQuery(title: string | null | undefined, query: string): boolean {
  const wanted = identifyingWords(query);
  if (wanted.length === 0) return true; // a generic search: nothing to match on
  if (!title) return false;

  const have = words(title);
  const found = wanted.filter((w) => have.some((h) => sameWord(h, w))).length;
  return found >= Math.ceil(wanted.length * 0.8);
}

/** The items that match the search, or all of them when too few do (so a odd title still gets an answer). */
export function relevantOrAll<T>(
  items: T[],
  titleOf: (item: T) => string | null | undefined,
  query: string,
  minimum = 3
): T[] {
  const relevant = items.filter((item) => matchesQuery(titleOf(item), query));
  return relevant.length >= minimum ? relevant : items;
}

/**
 * True when the listing shares at least one of the search's own numbers — a size, a pack count,
 * a model number, anything with a digit in it. False only when the query states such a number
 * and the listing states a DIFFERENT one (or none at all).
 *
 * Found live: with too few strict matches (matchesQuery, above) for a search, the Google/eBay
 * code falls back to using every listing rather than none, so an odd title still gets a price.
 * That fallback has no product-identity check at all, so a listing for a genuinely different
 * variant of the same brand — a search for "Old Spice ... 50ml - 6 Pack" pulling in "Old Spice
 * ... 96ml (3 Pack)" — was passing straight through: same brand and product words, wrong item
 * entirely, and its price (scaled to look like it matched our pack count) was quietly used as
 * the shown "retail price". Size/pack/model numbers are the one part of a title neither
 * `matchesQuery`'s generic-word list nor `isNotTheItem`'s accessory list ever screens for, so a
 * fallback pool needs its own, narrower check: not "does this look related", but "does this at
 * least NOT contradict the one number that tells these variants apart".
 */
export function sharesNumericIdentity(title: string | null | undefined, query: string): boolean {
  const queryNumbers = words(query).filter((w) => /\d/.test(w));
  if (!queryNumbers.length) return true; // nothing numeric in the search to disagree on
  if (!title) return false;
  const titleWords = words(title);
  return queryNumbers.some((qn) => titleWords.some((tw) => sameWord(tw, qn)));
}
