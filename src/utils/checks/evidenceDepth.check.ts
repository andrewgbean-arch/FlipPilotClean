// Run with: npx tsx src/utils/checks/evidenceDepth.check.ts (from the app root).
// Found 2026-10-05 in a 101-item valuation sweep: prices backed by one or two listings (a lone £37
// Persil, two Walkers listings, an Old Spice pack of 4 results) showed "High confidence", because the
// chip is the AI's own opinion and ignores how much market evidence there is.
import { evidenceDepth, limitConfidence } from "../evidenceDepth";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log("FAIL", label, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
};

// Unknown: nothing invented for results that predate the count.
eq("no google count: unknown, no note", evidenceDepth(undefined, 12).level, "unknown");
eq("null google count: unknown, no note", evidenceDepth(null, null).note, null);
eq("unknown never limits confidence", limitConfidence(95, evidenceDepth(undefined, undefined)), 95);

// None
const none = evidenceDepth(0, 0);
eq("0 + 0 listings: none", none.level, "none");
eq("none: note says it is an estimate", /estimate/.test(String(none.note)), true);
eq("none: confidence capped to Low", limitConfidence(100, none), 35);
eq("a missing eBay count counts as 0", evidenceDepth(0, null).level, "none");

// Thin
eq("1 listing: thin", evidenceDepth(1, 0).level, "thin");
eq("1 listing: singular wording", evidenceDepth(1, 0).note, "Based on only 1 listing, so treat it as a rough guide.");
eq("2 shop + 1 eBay = 3: thin, plural", evidenceDepth(2, 1).note, "Based on only 3 listings, so treat it as a rough guide.");
eq("thin: High is cut to Medium", limitConfidence(100, evidenceDepth(2, 0)), 55);
eq("thin never RAISES a low confidence", limitConfidence(30, evidenceDepth(2, 0)), 30);

// OK
eq("4 listings: ok, no note", evidenceDepth(4, 0).note, null);
eq("ok: confidence untouched", limitConfidence(88, evidenceDepth(3, 5)), 88);
eq("eBay alone can make it ok", evidenceDepth(0, 9).level, "ok");

// Odd input
eq("negative google count is treated as 0", evidenceDepth(-3, 0).level, "none");
eq("NaN google count is unknown", evidenceDepth(NaN, 5).level, "unknown");

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
