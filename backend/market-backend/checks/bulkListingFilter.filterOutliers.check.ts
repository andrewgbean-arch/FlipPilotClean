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

// REGRESSION (found 2026-10-05, a 101-item live sweep): the cheapest-anchored 3x cap deleted every
// real price whenever ONE cheap junk listing (a skin, brush, part, advert) slipped through. These
// are the real price lists seen live; the junk is at the LOW end and the real listings must survive.
const junkGoneRealKept = (label: string, prices: number[], junk: number[], minKept: number) => {
  const got = filterOutliers(prices);
  const bad = junk.filter((j) => got.includes(j));
  if (bad.length || got.length < minKept) {
    fail++;
    console.log("FAIL", label, "got", JSON.stringify(got), "junk surviving", JSON.stringify(bad), "kept", got.length, "want >=", minKept);
  }
};
const igr = (label: string, prices: number[], junk: number) => { if (filterOutliers(prices).includes(junk)) { fail++; console.log("FAIL", label); } };
junkGoneRealKept("PS5: a £29.99 listing no longer wipes out ten real £300-£580 prices", [29.99, 430, 430, 312, 450, 578, 496, 574, 570, 500], [29.99], 7);
junkGoneRealKept("Dyson V8: a £9.73 listing no longer wipes out the real £250-£700 prices", [9.73, 35.99, 54.99, 60.95, 250, 329.99, 414, 528, 699], [9.73], 3);
junkGoneRealKept("JBL Flip 6: a £2.02 listing no longer wipes out the real £37-£169 prices", [2.02, 22.99, 36.94, 57.9, 72, 77, 96, 104.4, 169.99, 357.35], [2.02], 6);
junkGoneRealKept("Airwrap: a £49 listing no longer wipes out the real £250-£580 prices", [49, 140, 160, 250, 260, 290, 399.99, 479.99, 579.99], [49], 5);
junkGoneRealKept("small sample: junk at the LOW end of 5 prices is dropped, not the real ones", [8.65, 410, 430, 455, 499], [8.65], 4);
// The shown Retail price is the dearest survivor, so inflated listings must not hide under a loose cap
// (a first median-3x version showed an iPad at £976 and a 55in TV at £1,303 on exactly this shape).
igr("iPad: a real £410-£471 cluster does not keep a £976 listing", [84, 179, 410, 471, 976], 976);
igr("Switch OLED: a £8,300 listing and a £507 one are dropped from a real £100-£330 spread", [100, 120, 130, 150, 150, 150, 220, 240, 250, 255, 256, 257, 275, 300, 319, 319, 330, 368, 427, 456, 507, 8300], 8300);
eq("junk at the HIGH end of the same shape is still dropped", filterOutliers([410, 430, 455, 499, 2400]), [410, 430, 455, 499]);

// FOUND BY REVIEW 2026-10-09: when the listings split into a cheap group and a dear group of about equal
// size, the median lands in the gap between them and the band around it held nothing. Every price was
// thrown away (or only the dear junk was left), Google came back with no prices at all, and the empty
// answer is cached nowhere so every Condition/Age change bought another paid search.
eq("two cheap + two dear: nothing is thrown away", filterOutliers([1.75, 2.0, 15.12, 15.5]), [1.75, 2.0, 15.12, 15.5]);
eq("a 2/2 split does not leave only the dear junk", filterOutliers([2, 2.1, 12, 13]), [2, 2.1, 12, 13]);
eq("three cheap + three dear: nothing is thrown away", filterOutliers([29.99, 29.99, 29.99, 450, 460, 470]), [29.99, 29.99, 29.99, 450, 460, 470]);
eq("five cheap + five dear: nothing is thrown away", filterOutliers([15, 15, 15, 15, 15, 450, 460, 470, 480, 500]).length, 10);
// A clear majority is still trusted over a minority, whichever end the minority is at.
eq("3 cheap + 1 dear: the dear one still goes", filterOutliers([1.75, 1.97, 2.27, 15.12]), [1.75, 1.97, 2.27]);
eq("1 cheap + 3 dear: the cheap one still goes", filterOutliers([29.99, 430, 450, 470]), [430, 450, 470]);

// It must never return nothing for a non-empty input: an empty answer means "no price at all".
{
  let seed = 4242;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  let empties = 0;
  for (let i = 0; i < 5000; i++) {
    const n = 1 + Math.floor(rnd() * 12);
    const prices = Array.from({ length: n }, () => Math.round(Math.exp(rnd() * 9 - 1) * 100) / 100);
    if (filterOutliers(prices).length === 0) empties++;
  }
  eq("5000 random price lists: never an empty answer", empties, 0);
}

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
