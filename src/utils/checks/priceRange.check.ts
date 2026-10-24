// Run with: npx tsx src/utils/checks/priceRange.check.ts (from the app root).
// Found 2026-10-18 on the owner's phone (first photo scans after the live OpenAI key was fixed): an "Electric
// Mountain Bike" showed Fair market price £510 over a track labelled £40.50 to £165.00 (eBay had caught brake
// sets, a seat post, tyres and a catalogue), with the marker pinned off the end; another result showed £1.30 under
// a £2.40 to £8.70 track. The track must hold the price it sits under, or not be drawn.
import { pickPriceRange, rangeHoldsPrice } from "../priceRange";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log("FAIL", label, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
};

// eBay's range holds the price: it is used (the speaker and the kitchen scale from the same phone test).
eq("speaker: £57 inside eBay £44.99 to £165", pickPriceRange({ low: 44.99, high: 165, aiLow: 50, aiHigh: 90, fair: 57 }), { low: 44.99, high: 165 });
eq("scale: £7.50 inside eBay £5.45 to £16.15", pickPriceRange({ low: 5.45, high: 16.15, fair: 7.5 }), { low: 5.45, high: 16.15 });

// eBay's range is around parts and extras: the AI's range is used if that holds the price.
eq("bike: £510 is far above eBay's £40.52 to £165, the AI's £400 to £700 holds it", pickPriceRange({ low: 40.52, high: 165, aiLow: 400, aiHigh: 700, fair: 510 }), { low: 400, high: 700 });

// Neither holds the price: no track rather than a misleading one.
eq("bike with no AI range: no track", pickPriceRange({ low: 40.52, high: 165, fair: 510 }), null);
eq("neither range holds the price: no track", pickPriceRange({ low: 40.52, high: 165, aiLow: 20, aiHigh: 90, fair: 510 }), null);
eq("price BELOW eBay's range (£1.30 under £2.40 to £8.70) and the AI range holds it", pickPriceRange({ low: 2.4, high: 8.7, aiLow: 0.5, aiHigh: 3, fair: 1.3 }), { low: 0.5, high: 3 });
eq("price below eBay's range, no AI range: no track", pickPriceRange({ low: 2.4, high: 8.7, fair: 1.3 }), null);

// Tolerance: a price just outside an end still counts (10%), well outside does not.
eq("just under the low end (10 vs 9.5) still inside", pickPriceRange({ low: 10, high: 20, fair: 9.5 }), { low: 10, high: 20 });
eq("just over the high end (20 vs 21.5) still inside", pickPriceRange({ low: 10, high: 20, fair: 21.5 }), { low: 10, high: 20 });
eq("well under the low end (10 vs 8) is outside", pickPriceRange({ low: 10, high: 20, fair: 8 }), null);
eq("well over the high end (20 vs 23) is outside", pickPriceRange({ low: 10, high: 20, fair: 23 }), null);

// No price to compare with: nothing contradicts the range, so the first usable one is kept as before.
eq("no fair price: eBay's range kept", pickPriceRange({ low: 5, high: 9, aiLow: 6, aiHigh: 8 }), { low: 5, high: 9 });
eq("null fair price: eBay's range kept", pickPriceRange({ low: 5, high: 9, fair: null }), { low: 5, high: 9 });
eq("no eBay range and no fair price: the AI's range", pickPriceRange({ aiLow: 6, aiHigh: 8 }), { low: 6, high: 8 });

// Unusable ranges are ignored, never drawn.
eq("high not above low: ignored, AI range used", pickPriceRange({ low: 9, high: 9, aiLow: 6, aiHigh: 12, fair: 9 }), { low: 6, high: 12 });
eq("reversed range: ignored", pickPriceRange({ low: 20, high: 10, fair: 15 }), null);
eq("strings and NaN: ignored", pickPriceRange({ low: "5", high: NaN, aiLow: undefined, aiHigh: null, fair: 7 }), null);
eq("nothing at all", pickPriceRange({}), null);
eq("a price in a string is not trusted as a price (no price: range kept)", pickPriceRange({ low: 5, high: 9, fair: "£7" }), { low: 5, high: 9 });

// rangeHoldsPrice is the one test both the track and the eBay block (ebayListings.ts) go by.
eq("rangeHoldsPrice: inside", rangeHoldsPrice(10, 20, 15), true);
eq("rangeHoldsPrice: at the low end", rangeHoldsPrice(10, 20, 10), true);
eq("rangeHoldsPrice: 10% under the low end is still inside", rangeHoldsPrice(10, 20, 9), true);
eq("rangeHoldsPrice: under the 10% tolerance is outside", rangeHoldsPrice(10, 20, 8.9), false);
eq("rangeHoldsPrice: 10% over the high end is still inside", rangeHoldsPrice(10, 20, 22), true);
eq("rangeHoldsPrice: over the 10% tolerance is outside", rangeHoldsPrice(10, 20, 22.1), false);
eq("rangeHoldsPrice: no price to compare, so it holds", rangeHoldsPrice(10, 20, null), true);

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
