// Run with: npx tsx market-backend/checks/bulkListingFilter.applianceCapacity.check.ts (from the backend folder).
// A real bug found live 2026-09-28: scanning a "Hotpoint Tumble Dryer" (no capacity in the AI's
// identified title — it's on an internal rating plate, never visible in a photo) priced it at
// £27-64 for something that genuinely costs about £400. Every real listing stating its normal
// 7-9kg load capacity was being dropped as an "oversized catering container" (isBulkListing's
// OVERSIZED_VOLUME rule), leaving only mismatched/spares listings to price from.
import { isBulkListing, isCapacityRatedGoods, priceForPack } from "../bulkListingFilter";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

// The scanned item is recognised as capacity-rated goods from its own (bare) title.
eq("Hotpoint Tumble Dryer recognised", isCapacityRatedGoods("Hotpoint Tumble Dryer"), true);
eq("Washing machine recognised", isCapacityRatedGoods("Bosch Washing Machine"), true);
eq("Fridge freezer recognised", isCapacityRatedGoods("Samsung Fridge Freezer"), true);
eq("Dumbbell recognised", isCapacityRatedGoods("Adjustable Dumbbell"), true);
eq("Gas bottle recognised", isCapacityRatedGoods("Calor Gas Bottle"), true);
eq("Rucksack recognised", isCapacityRatedGoods("Hiking Rucksack"), true);
eq("An ordinary consumable is not", isCapacityRatedGoods("Fairy Washing Up Liquid"), false);
eq("No query at all", isCapacityRatedGoods(null), false);

// The real reported case: a genuine tumble dryer listing stating its normal load capacity, with
// no size on the scanned item's own (bare) title, must no longer be dropped as bulk.
eq(
  "8kg tumble dryer kept for a bare-title scan",
  isBulkListing("Hotpoint 8kg Tumble Dryer White", null, null, isCapacityRatedGoods("Hotpoint Tumble Dryer")),
  false
);
eq(
  "9kg washing machine kept for a bare-title scan",
  isBulkListing("Bosch 9kg Washing Machine 1400 Spin", null, null, isCapacityRatedGoods("Bosch Washing Machine")),
  false
);
eq(
  "300L fridge freezer kept for a bare-title scan",
  isBulkListing("Samsung 300L Fridge Freezer", null, null, isCapacityRatedGoods("Samsung Fridge Freezer")),
  false
);
eq(
  "price kept for a real 8kg dryer listing",
  priceForPack("Hotpoint 8kg Tumble Dryer White", 249.99, null, null, isCapacityRatedGoods("Hotpoint Tumble Dryer")),
  249.99
);

// Without the flag (the old behaviour), the same listing is still wrongly dropped — proves the
// flag is what changes the outcome, not some other part of isBulkListing.
eq("without the flag, still wrongly dropped (old behaviour)", isBulkListing("Hotpoint 8kg Tumble Dryer White"), true);

// The flag must not blunt real bulk-wording detection for these same categories.
eq(
  "wholesale job lot of dryers still dropped even when capacity-rated",
  isBulkListing("Job Lot of 5 Tumble Dryers Wholesale", null, null, true),
  true
);
eq(
  "multipack wording on a capacity-rated item still dropped",
  isBulkListing("Dumbbell Multipack", null, null, true),
  true
);

// An ordinary consumable must be completely unaffected — the original bug this rule was built
// for is still caught exactly as before.
eq("5L washing up liquid still dropped, not capacity-rated", isBulkListing("Fairy Washing Up Liquid 5L", null, null, false), true);
eq("500ml bottle still fine, not capacity-rated", isBulkListing("Fairy Washing Up Liquid 500ml", null, null, false), false);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
