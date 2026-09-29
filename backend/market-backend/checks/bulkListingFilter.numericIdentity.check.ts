// Run with: npx tsx market-backend/checks/bulkListingFilter.numericIdentity.check.ts (from the backend folder).
// Found live 2026-09-30, right after the Old Spice pack-squaring fix: the SAME real 6-pack
// ("Old Spice Original Deodorant Stick for Men 50ml - 6 Pack") priced its Google-driven "Retail
// price" at £86.94, using a listing for "Old Spice Deodorant 3.25 Ounce Classic Original Round
// Stick (96ml) (3 Pack)" — a real product, but the wrong one: different size, different pack
// count, a different SKU entirely. It got in because Google Shopping (and eBay) fall back to
// EVERY listing when fewer than 3 pass the strict matchesQuery check, with no product-identity
// check on that fallback at all — matchesQuery's generic-word list, and isNotTheItem's
// accessory/spares list, both skip straight over size/pack/model numbers, which is exactly the
// one thing that told these two variants apart. sharesNumericIdentity closes that gap: a
// fallback listing must share at least one of the search's own numbers, or it's excluded.
import { sharesNumericIdentity } from "../bulkListingFilter";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

// The exact real case: a genuinely different variant must be rejected.
eq(
  "a 96ml/3-pack listing does not share the identity of a 50ml/6-pack search",
  sharesNumericIdentity(
    "Old Spice Deodorant 3.25 Ounce Classic Original Round Stick (96ml) (3 Pack)",
    "Old Spice Original Deodorant Stick for Men 50ml - 6 Pack"
  ),
  false
);

// A real match on size alone (no pack count stated) must still be allowed through.
eq(
  "a listing that states the same size, with no pack count, is not rejected",
  sharesNumericIdentity("Old Spice Original Deodorant Stick for Men 50ml", "Old Spice Original Deodorant Stick for Men 50ml - 6 Pack"),
  true
);

// A real match on pack count alone must still be allowed through.
eq(
  "a listing that states the same pack count, with no size, is not rejected",
  sharesNumericIdentity("Old Spice Original Deodorant Stick for Men - 6 Pack", "Old Spice Original Deodorant Stick for Men 50ml - 6 Pack"),
  true
);

// A model number works the same way as a size/pack count.
eq(
  "the next model up is rejected on its model number",
  sharesNumericIdentity("JBL Charge 5 Portable Bluetooth Speaker", "JBL Charge 4 Bluetooth Speaker"),
  false
);
eq(
  "the same model is not rejected",
  sharesNumericIdentity("JBL Charge 4 Portable Waterproof Speaker Black", "JBL Charge 4 Bluetooth Speaker"),
  true
);

// A search with no numbers at all has nothing to disagree on — never excluded by this check.
eq(
  "a search with no numbers in it is never rejected",
  sharesNumericIdentity("Some Completely Unrelated Listing Title", "Generic Wireless Speaker"),
  true
);

// No title at all (a malformed listing) is rejected once the search does have a number to check.
eq("no title, search has a number", sharesNumericIdentity(null, "JBL Charge 4 Bluetooth Speaker"), false);
eq("no title, search has no number", sharesNumericIdentity(null, "Generic Wireless Speaker"), true);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
