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
eq(
  "seat cushion: not the item when seating",
  isNotTheItem("Seat Cushion for Herman Miller Aeron Chair, Natural Latex Ergonomic Office", QUERY, false, true),
  true
);
eq(
  "a caster wheel: not the item when seating",
  isNotTheItem("Wheel For Herman Miller Hummanscale Office Home Chair Aeron Sayl Freedom Liberty", QUERY, false, true),
  true
);
eq(
  "lumbar support pad with words in between: not the item when seating",
  isNotTheItem("NEW Lumbar Back Support Pad For Herman Miller Classic Aeron Office Home Chair", QUERY, false, true),
  true
);

// The whole point of gating this list: without seatingGoods, "lumbar"/"arm pads"/"casters" must
// NOT be held against a whole chair genuinely marketed with these as selling points.
eq(
  "a real whole chair mentioning lumbar support is unaffected without the flag",
  isNotTheItem("Ergonomic Office Chair with Lumbar Support and Adjustable Arm Pads", "Office Chair", false, false),
  false
);
eq(
  "a real whole chair mentioning wheels and a cushioned seat is unaffected without the flag",
  isNotTheItem("Ergonomic Office Chair with 5 Smooth Wheels and Cushioned Seat", "Office Chair", false, false),
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

// Found live 2026-09-30: "cushion"/"foam" are a real chair-spare-part signal (confirmed above —
// "Seat Cushion for..." IS a spare) but ordinary whole-item marketing copy for a sofa: "reversible
// seat cushions" and "high-density foam" are how real sofas are actually sold. A sofa search still
// gets the rest of SEATING_PARTS_EXTRA (headrest, gas cylinder, lumbar pad, wheels, touch-up) —
// only the chair-only cushion/foam words are excluded for it.
const SOFA_QUERY = "3 Seater Sofa";
eq("a sofa is still recognised as seating goods", isSeatingGoods(SOFA_QUERY), true);
eq(
  "a real whole sofa advertising reversible cushions is unaffected",
  isNotTheItem("Large Grey Fabric 3 Seater Sofa with Reversible Cushions", SOFA_QUERY, false, true),
  false
);
eq(
  "a real whole sofa advertising high-density foam is unaffected",
  isNotTheItem("Corner Sofa, High-Density Foam Seats, Grey Fabric", SOFA_QUERY, false, true),
  false
);
// A chair, meanwhile, must still be caught on the exact same words — the sofa carve-out must not
// leak into chairs, which is where the real spare-part signal was found live in the first place.
eq(
  "a chair's own cushion spare is still caught (unaffected by the sofa carve-out)",
  isNotTheItem("Seat Cushion for Herman Miller Aeron Chair, Natural Latex Ergonomic Office", QUERY, false, true),
  true
);
// A sofa's own genuine spare parts (not cushion/foam) must still be caught as before — no
// "replacement"/"spare" wording here, so this isolates SEATING_PARTS_EXTRA itself, not the
// separate general NOT_THE_ITEM list.
eq(
  "a sofa's own gas cylinder spare is still caught",
  isNotTheItem("Gas Cylinder for Recliner Sofa Mechanism, Class 4", SOFA_QUERY, false, true),
  true
);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
