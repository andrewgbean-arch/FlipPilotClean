// Run with: npx tsx market-backend/checks/bulkListingFilter.groceryPacks.check.ts (from the backend folder).
// Found 2026-10-05 reading every raw Google listing behind a 101-item valuation sweep. Three grocery
// pack-size misreads, each pushing a wrong price into the shown figure:
//   1. "Box of 17" wholesale boxes (five Cadbury Dairy Milk 180g listings at £42-£51) were kept as
//      single bars; only "Case of" was recognised as bulk.
//   2. "Pampers Size 4 Nappies 44 Pack" read the size "4" as 4 nappies and multiplied it by the 44-pack:
//      a wanted count of 176, so every listing was scaled against the wrong pack.
//   3. "Andrex ... 9 Rolls" had no pack size at all ("rolls" wasn't a counted word), so "4 x 9 Rolls" and
//      "45 Rolls" listings were shown at their full multi-pack price instead of scaled to 9 rolls.
import { extractPackCount, isBulkListing, priceForPack } from "../bulkListingFilter";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log("FAIL", label, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
};

// 1. Box of N
eq("a wholesale 'Box of 17' is bulk", isBulkListing("Cadbury Dairy Milk Chocolate Bar 180g (Box of 17)"), true);
eq("'Box of 15' is bulk", isBulkListing("Dairy Milk Fruit & Nut Chocolate Bar 180g (Box of 15)"), true);
eq("'Boxes of 6' is bulk", isBulkListing("Walkers Crisps Boxes of 6"), true);
eq("a 'box of 12' is NOT bulk when the scanned pack is itself 12", isBulkListing("Krispy Kreme Original Glazed Box of 12", 12), false);
eq("a plain single bar is not bulk", isBulkListing("Cadbury Dairy Milk Chocolate Bar 180g"), false);
eq("'box' alone (no 'of N') is not bulk", isBulkListing("Lindt Lindor Milk Chocolate Truffles Box 200g"), false);

// 2. Size N Nappies
eq("'Size 4 Nappies 44 Pack' is a 44 pack, not 176", extractPackCount("Pampers Baby Dry Size 4 Nappies 44 Pack"), 44);
eq("a real '76 Nappies' still counts", extractPackCount("Pampers Baby-dry Size 4+, 76 Nappies, Jumbo+ Pack"), 76);
eq("'Sizes 5 Nappies 30 Pack' too", extractPackCount("Huggies Sizes 5 Nappies 30 Pack"), 30);
eq("a 44-pack listing scaled to a 44 scan is left alone", priceForPack("Pampers Baby Dry Size 4 Nappies 44 Pack", 11.33, 44), 11.33);

// 3. Rolls
eq("'9 Rolls' is a pack size", extractPackCount("Andrex Classic Clean Toilet Tissue 9 Rolls"), 9);
eq("'4 x 9 Rolls' is 36 rolls", extractPackCount("Andrex Complete clean Toilet Tissue 4 x 9 Rolls"), 36);
eq("a 36-roll £19.29 listing scales to 9 rolls", priceForPack("Andrex Complete clean Toilet Tissue 4 x 9 Rolls", 19.29, 9), 4.82);
eq("a 45-roll listing scales to 9 rolls", priceForPack("Andrex Classic Clean Toilet Roll Tissue Paper - 45 Rolls White", 38.41, 9), 7.68);
eq("a same-size 9 Rolls listing is left alone", priceForPack("Andrex Family Soft Toilet Tissue, 2-ply, 9 Rolls", 4.99, 9), 4.99);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
