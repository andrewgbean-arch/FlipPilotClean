// Run with: npx tsx market-backend/checks/fetchMarketData.evidenceCache.check.ts (from the backend folder).
// Found live 2026-09-29: a Vitamix A3500 blender genuinely needed Google Shopping (ebayIsStrong
// said no) but Google hadn't answered by the old 3s grace period — and the resulting HALF-answer
// (no Google price at all) got cached for the full 10 minutes anyway, serving the same wrong price
// to every identical scan in that window even though a retry moments later found real results.
import { clearMarketCachesForTests, evidenceCacheGet, evidenceCacheSet } from "../fetchMarketData";
import type { MarketEvidence } from "../fetchMarketData";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

// A minimal, real-shaped bit of evidence — only what evidenceCacheSet actually reads matters.
function evidence(overrides: Partial<MarketEvidence["priceInputs"]> = {}): MarketEvidence {
  return {
    lowest: 400,
    priceInputs: {
      ebayNew: null,
      ebay: 437.49,
      googleNew: null,
      aiNew: 599,
      aiUsedMin: 400,
      aiUsedMax: 500,
      marketFloor: null,
      ...overrides,
    },
  } as unknown as MarketEvidence;
}

clearMarketCachesForTests();

// Google was needed and still came back empty: NOT cached, so the next scan retries fresh.
evidenceCacheSet("vitamix-needed-missing", evidence(), true);
eq("google needed but still missing: not cached", evidenceCacheGet("vitamix-needed-missing"), null);

clearMarketCachesForTests();

// Google was needed and DID come back: cached as normal.
evidenceCacheSet("vitamix-needed-found", evidence({ googleNew: 684.95 }), false);
eq("google needed and found: cached", evidenceCacheGet("vitamix-needed-found") !== null, true);

clearMarketCachesForTests();

// Google was never needed at all (eBay was strong enough): cached as normal, same as always —
// the new 3rd argument only changes behaviour for the specific "needed but missing" case.
evidenceCacheSet("ordinary-scan", evidence(), false);
eq("google never needed: cached as normal", evidenceCacheGet("ordinary-scan") !== null, true);

clearMarketCachesForTests();

// A totally empty lookup (nothing from any source) still isn't cached either way — the existing,
// unrelated guard for a fully failed lookup.
evidenceCacheSet(
  "nothing-at-all",
  { lowest: null, priceInputs: { ebayNew: null, ebay: null, googleNew: null, aiNew: null, aiUsedMin: null, aiUsedMax: null, marketFloor: null } } as unknown as MarketEvidence,
  false
);
eq("a fully empty lookup: still not cached", evidenceCacheGet("nothing-at-all"), null);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
