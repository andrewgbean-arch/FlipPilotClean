// Run with: npx tsx market-backend/checks/bulkListingFilter.packSquaring.check.ts (from the backend folder).
// Found live 2026-09-29: a real Sainsbury's Old Spice 6-pack ("...50ml - 6 Pack") was priced as if
// it were a 36-pack. Root cause: this morning's fix for the Monster Munch "6 X3 Packs" bug added
// "packs?" to the shared COUNT_STEMS list, which also feeds COUNT_WORD ("N <stem>" = a stated
// total). With "pack" now a recognised stem, COUNT_WORD started matching "6 Pack" as "6 units" on
// top of the SAME "6 Pack" already being read as a x6 multiplier elsewhere — 6 * 6 = 36. "Pack" is
// a container word, not a unit-of-the-thing word like "lozenge"/"tablet"/"sachet", and belongs only
// to the narrower dimension guard that needed it, not the shared stem list every count check reads.
import { extractPackCount, isBulkListing } from "../bulkListingFilter";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

// The exact real case.
eq(
  "a real 6-pack reads as 6, not 36",
  extractPackCount("Old Spice Original Deodorant Stick for Men 50ml - 6 Pack"),
  6
);
eq("the same, no hyphen", extractPackCount("Old Spice Original Deodorant Stick for Men 50ml 6 Pack"), 6);
eq("a different product, same shape", extractPackCount("Sensodyne Toothpaste 75ml - 4 Pack"), 4);
eq("plural 'Packs' still reads as itself, not squared", extractPackCount("Fairy Non Bio Pods - 12 Packs"), 12);

// The two fixes this had to not break.
eq("34x32 (this morning's dimension fix) is still not a pack count", extractPackCount("Levi's 501 Jeans 34x32"), null);
eq(
  "6 X3 Packs (this morning's Monster Munch fix) is still a real multipack",
  isBulkListing("Walkers Monster Munch Roast Beef Flavour Crisp Snack 6 X3 Packs 0.70"),
  true
);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
