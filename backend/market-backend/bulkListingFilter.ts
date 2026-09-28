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
      if (n >= 2 && n <= 1000 && !precededByNumber && !looksLikeDimensionTail(tail, COUNT_STEMS_WITH_CT)) return n;
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
const NOT_THE_ITEM =
  /\b(case|cover|pouch|sleeve|skin|strap|lanyard|stand|mount|holder|bracket|cable|charger|charging|adapter|adaptor|battery|batteries|replacement|spare|spares|parts|repair|faulty|broken|damaged|untested|manual|sticker|decal|box only|empty box|not working|no power|dead|clip|hook|chuck|bits|brushes|gasket|nozzle|tank|filter|filters|descaler|descaling|valve|seal|seals|pipe|hose|jug|carafe|portafilter|group\s?head|3d model|3d render|digital model|cad model|stl file|render pack)\b/gi;

/**
 * True when a listing looks like an accessory, spare part or faulty unit rather
 * than the item searched for. A word the search itself contains does not count
 * (searching "phone charger" must keep listings that say "charger").
 */
export function isNotTheItem(title: string | null | undefined, query: string): boolean {
  if (!title) return false;
  const wanted = query.toLowerCase();
  const found = title.match(NOT_THE_ITEM);
  if (!found) return false;
  return found.some((word) => !wanted.includes(word.toLowerCase()));
}

/**
 * True when a listing is not comparable to the item that was scanned and should be ignored. See the
 * note at the top for what `wantedCount` changes. `ownVolume` is the litres/kg the SCANNED item's own
 * title states, if any — so a real 5.2L air fryer's own listings aren't thrown out by the same rule
 * that (rightly) drops a 5L catering tub of washing-up liquid for a scan of a small bottle of it.
 */
export function isBulkListing(
  title: string | null | undefined,
  wantedCount?: number | null,
  ownVolume?: number | null
): boolean {
  if (!title) return false;
  if (BULK_WORDING.some((re) => re.test(title))) return true;

  const volumeMatch = title.match(OVERSIZED_VOLUME);
  if (volumeMatch) {
    const listingVolume = parseFloat(volumeMatch[1]);
    const allowed = ownVolume && ownVolume >= OVERSIZED_THRESHOLD ? ownVolume * 1.5 : OVERSIZED_THRESHOLD;
    if (listingVolume >= allowed) return true;
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
  ownVolume?: number | null
): number | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  if (isBulkListing(title, wantedCount, ownVolume)) return null;

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
    "snacks snack crisps flavour flavor flavoured size sized"
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
