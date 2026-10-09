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

/** The confidence to show: the AI's own figure, never higher than the evidence allows. */
export function limitConfidence(confidence: number, depth: EvidenceDepth): number {
  return depth.maxConfidence == null ? confidence : Math.min(confidence, depth.maxConfidence);
}
