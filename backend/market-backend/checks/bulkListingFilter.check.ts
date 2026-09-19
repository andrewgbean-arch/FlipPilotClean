// Run with: npx tsx market-backend/checks/bulkListingFilter.check.ts (from the backend folder).
// Titles are real listings seen on eBay and Amazon UK for nicotine lozenges.
import { isBulkListing, extractPackCount, listingUnits, priceForPack } from "../bulkListingFilter";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

// pack counts from text
eq("72 lozenges", extractPackCount("Nicorette Cools 4mg 72 Lozenges"), 72);
eq("pack of 4", extractPackCount("Sensodyne Toothpaste Pack of 4"), 4);
eq("6 x 1L", extractPackCount("Fairy 6 x 1L"), 6);
eq("no count", extractPackCount("Nicorette Icy Mint 4mg Lozenges"), null);
eq("mg not count", extractPackCount("Nicotine 4mg Mint"), null);
eq("20 lozenges", extractPackCount("Boots Nicotine 2mg Lozenge 20 Lozenges"), 20);
eq("OFF quantity", extractPackCount("20 lozenges"), 20);
eq("OFF ml", extractPackCount("500 ml"), null);

// real eBay titles seen in the live test
eq("6x 80s total 480", listingUnits("6x Nicorette Cools 4mg Icy Mint Lozenges 80s – Total 480 Lozenges"), 480);
eq("10x 80s", listingUnits("10x Nicorette Cools 4mg Icy Mint Lozenges 80s – Total 800 Lozenges"), 800);
eq("80 Lozenges", listingUnits("Nicorette Cools Icy Mint 4mg Lozenges – 80 Lozenges"), 80);
eq("210 Gums", listingUnits("Nicorette Icy White Gum 4mg, 210 Gums Expiry October 2027"), 210);
eq("2 X(80)", listingUnits("2 X(80) Nicorette Icy White Lozenges 4mg +1(80) 2mg Lozenges"), 160);
eq("40 x lozenges", listingUnits("Nicorette Icy Mint Cools 2mg 40 x Nicotine Lozenges NEXT DAY"), 40);
eq("typo Lozengse", listingUnits("Nicorette 4mg Icy Mint 80 Lozengse Box Brand New EXP 2027"), 80);
eq("2× no size", listingUnits("Nicorette Cools 4mg Lozenges Nicotine Sugar Free Icy Mint 2×"), null);

// pricing scaled to a 20-pack
eq("80 -> 20", priceForPack("Nicorette Cools Icy Mint 4mg Lozenges – 80 Lozenges", 21.19, 20), 5.3);
eq("480 -> 20", priceForPack("6x Nicorette Cools 4mg Icy Mint Lozenges 80s – Total 480 Lozenges", 79.99, 20), 3.33);
eq("800 too big dropped", priceForPack("10x Nicorette Cools 4mg Icy Mint Lozenges 80s – Total 800 Lozenges", 135.99, 20), null);
eq("same size unchanged", priceForPack("Nicorette 4mg 20 Lozenges", 3.99, 20), 3.99);
eq("no size stated unchanged", priceForPack("Nicorette Icy Mint 4mg Lozenges", 4.5, 20), 4.5);
eq("2x no size dropped", priceForPack("Nicorette Cools 4mg Lozenges 2×", 22.5, 20), null);
eq("wholesale dropped", priceForPack("Nicorette wholesale box 20 lozenges", 3, 20), null);
eq("multipack wording dropped", priceForPack("Nicorette Multipack", 9, 20), null);
eq("bad price", priceForPack("Nicorette 20 lozenges", NaN, 20), null);

// without a wanted size: the old rule
eq("no wanted: pack of 5", isBulkListing("Fairy pack of 5"), true);
eq("no wanted: single", isBulkListing("Fairy Original Washing Up Liquid 500ml"), false);
eq("no wanted: 5L", isBulkListing("Fairy 5L"), true);
eq("no wanted: 6x", isBulkListing("6x Nicorette Cools"), true);
eq("no wanted: price untouched", priceForPack("Fairy 500ml", 1.5), 1.5);

// wanted 4-pack
eq("4 pack kept when wanted 4", priceForPack("Andrex Toilet Roll pack of 4", 6, 4), 6);
eq("pack of 12 dropped when wanted 4?", priceForPack("Andrex Toilet Roll pack of 12", 15, 4), null);
eq("XL shirt not a multiplier", isBulkListing("Tshirt 2 XL"), false);


// Amazon UK titles
eq("80 Lozenges (2 x 40 Packs)", listingUnits("Cools 4mg Lozenge, 80 Lozenges (2 x 40 Packs), Effective and Discreet"), 80);
eq("160 Pieces (4 x 40 Packs)", listingUnits("ICY Mint 4mg Lozenge, 160 Pieces (4 x 40 Packs), Effective"), 160);
eq("Pack of 100 unknown size", listingUnits("Minis Mint Nicotine Lozenges 4mg, Pack of 100"), null);
eq("Pack of 100 dropped for 20", priceForPack("Minis Mint Nicotine Lozenges 4mg, Pack of 100", 17, 20), null);
eq("4 X 20 Lozenges (80)", listingUnits("Nicorette Cools 4mg Lozenge Icy Mint 4 X 20 Lozenges ( 80 In Total)"), 80);
eq("2x80", listingUnits("Nicorette Cools 2mg Lozenges Icy Mint 2x80 Lozenges"), 160);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
