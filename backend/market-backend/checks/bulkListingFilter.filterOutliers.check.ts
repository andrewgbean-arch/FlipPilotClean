// Run with: npx tsx market-backend/checks/bulkListingFilter.filterOutliers.check.ts (from the backend folder).
// Found live 2026-09-30: a real "Cadbury Double Decker 160g 4 Pack" scan showed a Retail price of
// £3.50 driven by a googlePriceMax of £29.99 — genuine 4-pack listings clustered at £1.75-£2.27,
// but a handful of same-titled listings priced far higher (a real £15.12 one, confirmed live)
// sailed straight through with zero protection. Two compounding bugs, both fixed here:
//   1. Below 4 prices, filterOutliers did nothing at all — common for a grocery item, where only
//      a handful of comparable listings turn up after per-listing bulk detection.
//   2. Even at 4+ prices, the IQR (interquartile range) method alone is unreliable for a small
//      sample: with only 3 genuine listings plus 1 outlier, the outlier itself becomes the upper
//      quartile (q3), so its "upper bound" is drawn around itself and it survives untouched.
// filterOutliers now also used to be duplicated byte-for-byte between fetchMarketData.ts (Google)
// and ebayBrowseApi.ts (eBay); both now import this single, shared, fixed version.
import { filterOutliers } from "../bulkListingFilter";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log("FAIL", label, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
};

// The exact real case (rounded to what was actually seen live).
eq(
  "the exact real Double Decker case: the two outliers are dropped, the genuine cluster survives",
  filterOutliers([1.97, 1.75, 9.99, 15.12, 2.27]),
  [1.97, 1.75, 2.27]
);

// The previously-broken boundary: exactly 4 prices, one of them a real outlier.
eq(
  "4 prices (3 genuine + 1 outlier): the outlier no longer survives by defining its own quartile",
  filterOutliers([1.75, 1.97, 2.27, 15.12]),
  [1.75, 1.97, 2.27]
);

// Below 4 prices: the old code did nothing at all here. Must now still filter.
eq("3 prices, one a clear outlier: still filtered", filterOutliers([1.75, 2.27, 15.12]), [1.75, 2.27]);
eq("2 prices, one a clear mismatch (6x the cheapest): the outlier is dropped", filterOutliers([4, 24]), [4]);

// Real variance must survive — this is a safety net against mismatched listings, not a
// clampdown on ordinary price spread between genuine sellers of the same exact product.
eq("2 prices, a real premium seller at 2.5x: both survive", filterOutliers([4, 10]), [4, 10]);
eq("2 prices, no outlier at all: untouched", filterOutliers([1.75, 2.27]), [1.75, 2.27]);
eq("a single price: untouched (nothing to compare it against)", filterOutliers([9.99]), [9.99]);
eq("no prices at all: untouched", filterOutliers([]), []);

// A larger, genuinely wide-but-real spread (mirrors the De'Longhi Rivelia case from earlier
// tonight: real UK listings £498-£937, well within 3x) must not be wrongly clamped.
eq(
  "a real, wide but legitimate spread (well under 3x) survives at a larger sample size too",
  filterOutliers([498, 517, 600, 750, 937]),
  [498, 517, 600, 750, 937]
);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
