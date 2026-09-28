// Run with: npx tsx market-backend/checks/bulkListingFilter.wordMisreads.check.ts (from the backend folder).
// Covers 2026-09-26 audit item 4: "pricing filters misread ordinary words" — 9ct gold, Levi's 501s,
// dimensions/clothing sizes, "console bundle", and oversized-volume vs the scanned item's own size.
import { extractPackCount, isBulkListing, extractVolume, priceForPack } from "../bulkListingFilter";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

// 9ct/18ct gold must not read as a pack count
eq("9ct gold ring: no pack count", extractPackCount("9ct gold ring"), null);
eq("9ct gold ring: not bulk", isBulkListing("9ct gold ring"), false);
eq("18ct white gold ring: no pack count", extractPackCount("18ct white gold ring"), null);
eq("9ct yellow gold chain: no pack count", extractPackCount("9ct yellow gold chain"), null);
eq("9ct rose gold ring: no pack count", extractPackCount("9ct rose gold ring"), null);
// a real "Nct" pack size (not gold) must still work
eq("80ct tablets still reads as 80", extractPackCount("Vitamin C 80ct Tablets"), 80);

// Levi's 501s / a bare decade must not read as a count
eq("Levi's 501s: no pack count", extractPackCount("Levi's 501s Original Fit Jeans"), null);
eq("Levi's 501s: not bulk", isBulkListing("Levi's 501s Original Fit Jeans"), false);
eq("80s decade: no pack count", extractPackCount("80s Retro Denim Jacket"), null);
// a real trailing-s pack size (a count word also present) must still work
eq("Lozenges 80s still reads as 80", extractPackCount("Nicorette Lozenges 80s"), 80);

// Dimensions and clothing sizes must not read as multipacks
eq("34x32 jeans: no pack count", extractPackCount("Levi's 501 Jeans 34x32"), null);
eq("34x32 jeans: not bulk", isBulkListing("Levi's 501 Jeans 34x32"), false);
eq("120 x 60cm rug: no pack count", extractPackCount("Bathroom Rug 120 x 60cm"), null);
eq("120 x 60cm rug: not bulk", isBulkListing("Bathroom Rug 120 x 60cm"), false);
eq("30 x 20 x 10cm box: no pack count", extractPackCount("Storage Box 30 x 20 x 10cm"), null);
eq("2 XL tshirt: not bulk", isBulkListing("Tshirt 2 XL"), false);
// a real multiplier must still work
eq("6x Nicorette still totals 480", extractPackCount("6x Nicorette Cools 4mg Icy Mint Lozenges 80s – Total 480 Lozenges"), 480);
eq("2 x 500ml still a bulk multiplier", isBulkListing("Fairy Washing Up Liquid 2 x 500ml"), true);

// "console bundle" must not be dropped as bulk wording
eq("PS5 Console Bundle: not bulk", isBulkListing("Sony PS5 Console Bundle with 2 Controllers"), false);
eq("Xbox Series X Bundle: not bulk", isBulkListing("Xbox Series X Console Bundle"), false);
eq("PS5 Bundle: price kept", priceForPack("Sony PS5 Console Bundle with 2 Controllers", 449.99), 449.99);
// genuinely wholesale wording must still be caught
eq("wholesale job lot still bulk", isBulkListing("Job Lot of 10 Consoles Wholesale"), true);

// Oversized volume vs the scanned item's own stated size
eq("air fryer's own volume read", extractVolume("Ninja Foodi Dual Zone Air Fryer 9.5L"), 9.5);
eq("no volume stated", extractVolume("Nicorette Lozenges"), null);
eq("5.2L air fryer listing kept for a 5.2L scan", isBulkListing("Ninja Air Fryer 5.2L", null, 5.2), false);
eq("9.5L catering tub still dropped for a 5.2L scan", isBulkListing("Cooking Oil 9.5L Catering Tub", null, 5.2), true);
eq("5L washing up liquid still dropped with no own-size", isBulkListing("Fairy Washing Up Liquid 5L"), true);
eq("500ml bottle not oversized", isBulkListing("Fairy Washing Up Liquid 500ml"), false);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
