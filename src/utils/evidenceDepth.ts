/**
 * How many real listings stand behind a price, and what the result screen should say about that.
 *
 * The confidence chip on a scan result is the AI's own opinion of its estimate, which says nothing
 * about how much market evidence there is. A price from a single listing (a lone £37 Persil, a pair
 * of Walkers crisps listings) looked exactly as trustworthy as one backed by thirty. So the screen
 * counts the listings behind the price (the shop listings that survived filtering, plus eBay's) and
 * is honest when there are very few: a plain note, and a ceiling on how confident the chip may claim.
 *
 * "unknown" is for a result that predates the count (an older server reply, or one saved earlier):
 * nothing is invented for it.
 */
export type EvidenceDepth =
  | { level: "unknown"; total: null; note: null; maxConfidence: null }
  | { level: "none" | "thin" | "ok"; total: number; note: string | null; maxConfidence: number | null };

// At most this many listings counts as thin.
export const THIN_LISTINGS = 3;
// The chip's bands are Low < 40, Medium < 70, High: a thin price may be at most Medium, an
// AI-only one at most Low.
export const THIN_MAX_CONFIDENCE = 55;
export const NONE_MAX_CONFIDENCE = 35;

export function evidenceDepth(googleCount: unknown, ebayCount: unknown): EvidenceDepth {
  if (typeof googleCount !== "number" || !Number.isFinite(googleCount)) {
    return { level: "unknown", total: null, note: null, maxConfidence: null };
  }
  const ebay = typeof ebayCount === "number" && Number.isFinite(ebayCount) && ebayCount > 0 ? ebayCount : 0;
  const total = Math.max(0, Math.round(googleCount)) + Math.round(ebay);

  if (total === 0) {
    return {
      level: "none",
      total,
      note: "No shop or eBay listings found, so this is an estimate rather than a market price.",
      maxConfidence: NONE_MAX_CONFIDENCE,
    };
  }
  if (total <= THIN_LISTINGS) {
    return {
      level: "thin",
      total,
      note: `Based on only ${total} listing${total === 1 ? "" : "s"}, so treat it as a rough guide.`,
      maxConfidence: THIN_MAX_CONFIDENCE,
    };
  }
  return { level: "ok", total, note: null, maxConfidence: null };
}

/** From this many listings a price stands on real evidence, whatever the AI says about the name. */
export const STRONG_LISTINGS = 10;

/**
 * The AI said it does not actually know this make and model (a photo that only shows what KIND of thing it is, like "Electric Mountain Bike", or a brand it has not
 * heard of) and fewer than STRONG_LISTINGS real listings stand behind the price. The shop and eBay figures may then be for other products (a plain "Electric
 * Mountain Bike" matched £3,199 to £8,999 carbon bikes, and was shown with "High confidence", 10 Nov 2026), so the screen calls the price a rough guide.
 * Never true for a result that predates the listing count, or when the AI said nothing.
 */
export function guessedFromTheName(aiRecognised: unknown, depth: EvidenceDepth): boolean {
  return aiRecognised === false && depth.level !== "unknown" && depth.total < STRONG_LISTINGS;
}

/** The FlipScore is "Strong" from 70: a price that is only a guess from the name may not be called that, whatever the score worked out. */
export const GUESSED_FLIP_SCORE_MAX = 55;
export function limitFlipScore(score: number, guessed: boolean): number {
  return guessed ? Math.min(score, GUESSED_FLIP_SCORE_MAX) : score;
}

/** The confidence to show: the AI's own figure, never higher than the evidence allows (and at most Low when the price is a guess from the name). */
export function limitConfidence(confidence: number, depth: EvidenceDepth, guessed: boolean = false): number {
  const cap = guessed ? Math.min(depth.maxConfidence ?? NONE_MAX_CONFIDENCE, NONE_MAX_CONFIDENCE) : depth.maxConfidence;
  return cap == null ? confidence : Math.min(confidence, cap);
}
