// Run with: npx tsx src/utils/checks/evidenceDepth.check.ts (from the app root).
// Found 2026-10-05 in a 101-item valuation sweep: prices backed by one or two listings (a lone £37
// Persil, two Walkers listings, an Old Spice pack of 4 results) showed "High confidence", because the
// chip is the AI's own opinion and ignores how much market evidence there is.
import { evidenceDepth, guessedFromTheName, limitConfidence, limitFlipScore, STRONG_LISTINGS } from "../evidenceDepth";

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

// A name the AI does not know, with little real evidence behind the price: a rough guide, at most Low. Found 10 Nov 2026: a photo scan titled just
// "Electric Mountain Bike" matched £3,199 to £8,999 carbon bikes in the shops (the screen showed them as "Retail price"), 3 junk eBay listings, and a
// £500 AI guess, and was shown with "High confidence".
eq("the AI does not know it, 6 listings behind it: guessed", guessedFromTheName(false, evidenceDepth(3, 3)), true);
eq("nothing found at all: guessed", guessedFromTheName(false, evidenceDepth(0, 0)), true);
eq("9 listings is still thin evidence: guessed", guessedFromTheName(false, evidenceDepth(0, 9)), true);
eq(`${STRONG_LISTINGS} listings is real evidence: not guessed`, guessedFromTheName(false, evidenceDepth(0, STRONG_LISTINGS)), false);
eq("exactly 10 listings is where real evidence starts", [STRONG_LISTINGS, guessedFromTheName(false, evidenceDepth(0, 10))], [10, false]);
eq("the AI knows it: never guessed", guessedFromTheName(true, evidenceDepth(0, 0)), false);
eq("the AI said nothing: never guessed", guessedFromTheName(null, evidenceDepth(0, 0)), false);
eq("a result that predates the count: never guessed", guessedFromTheName(false, evidenceDepth(undefined, undefined)), false);
eq("the word 'false' is not the AI saying no", guessedFromTheName("false", evidenceDepth(0, 0)), false);
eq("guessed: High is cut to Low", limitConfidence(70, evidenceDepth(3, 3), true), 35);
eq("guessed never RAISES a lower confidence", limitConfidence(20, evidenceDepth(3, 3), true), 20);
eq("guessed on thin evidence: the lower cap wins (Low)", limitConfidence(90, evidenceDepth(1, 0), true), 35);
eq("guessed: a Strong FlipScore (71) is cut to Fair", limitFlipScore(71, true), 55);
eq("guessed never RAISES a lower FlipScore", limitFlipScore(30, true), 30);
eq("not guessed: the FlipScore is untouched", limitFlipScore(71, false), 71);
eq("not guessed: not even a perfect one", limitFlipScore(100, false), 100);
eq("not guessed: untouched", limitConfidence(70, evidenceDepth(3, 3), false), 70);
eq("the third argument is optional", limitConfidence(70, evidenceDepth(3, 3)), 70);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
