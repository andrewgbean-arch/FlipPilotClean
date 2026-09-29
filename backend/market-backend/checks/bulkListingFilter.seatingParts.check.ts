// Run with: npx tsx market-backend/checks/bulkListingFilter.seatingParts.check.ts (from the backend folder).
// Found live 2026-09-29: every "new condition" eBay result for "Herman Miller Aeron Chair" was a
// spare part (a headrest, a gas cylinder, a lumbar pad, arm pads, seat foam, touch-up paint) —
// none caught by isNotTheItem, dragging the whole chair's own new price down to a few pounds.
import { isNotTheItem, isSeatingGoods } from "../bulkListingFilter";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

const QUERY = "Herman Miller Aeron Chair";
eq("a chair is recognised as seating goods", isSeatingGoods(QUERY), true);
eq("a sofa is recognised as seating goods", isSeatingGoods("DFS Corner Sofa"), true);
eq("an ordinary product is not", isSeatingGoods("Herman Miller Aeron"), false); // no "chair"/seating word at all
eq("no query at all", isSeatingGoods(null), false);

// The exact real listings found live, verbatim.
eq(
  "mesh headrest: not the item when seating",
  isNotTheItem("Mesh Headrest for Classic Herman Miller Aeron Chair Graphite", QUERY, false, true),
  true
);
eq(
  "gas cylinder: not the item when seating",
  isNotTheItem("Heavy Duty Herman Miller Aeron A B Chair Gas Cylinder Class 4 500+ SOLD", QUERY, false, true),
  true
);
eq(
  "lumbar support pad: not the item when seating",
  isNotTheItem("Lumbar Support Back Lumber Pad Size B for Herman Miller Aeron Chair 1200+ SOLD", QUERY, false, true),
  true
);
eq(
  "arm pads: not the item when seating",
  isNotTheItem("Herman Miller Arm Pads Armpad Armpads AERON Chair incl FIXING SCREWS 100' sold", QUERY, false, true),
  true
);
eq(
  "seat foam: not the item when seating",
  isNotTheItem("Herman Miller Aeron Size B Seat Chair Foam Pad Sponge Insert 1000's sold", QUERY, false, true),
  true
);
eq(
  "touch up spray paint: not the item when seating",
  isNotTheItem("Herman Miller Aeron CLASSIC Chair Touch Up Spray Paint Can - Graphite Colour", QUERY, false, true),
  true
);

// The whole point of gating this list: without seatingGoods, "lumbar"/"arm pads"/"casters" must
// NOT be held against a whole chair genuinely marketed with these as selling points.
eq(
  "a real whole chair mentioning lumbar support is unaffected without the flag",
  isNotTheItem("Ergonomic Office Chair with Lumbar Support and Adjustable Arm Pads", "Office Chair", false, false),
  false
);
// And the same is true even when the flag is simply left out (the default for every ordinary product).
eq(
  "without the flag at all, still unaffected (default)",
  isNotTheItem("Ergonomic Office Chair with Lumbar Support", "Office Chair"),
  false
);

// A real whole chair, correctly kept once the spares are gone.
eq(
  "the real whole chair (new/old stock): is the item",
  isNotTheItem("Herman Miller Aeron Chair New/Old Stock Delivery for London and outskirts", QUERY, false, true),
  false
);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
