// Run with: npx tsx market-backend/checks/bulkListingFilter.applianceParts.check.ts (from the backend folder).
// Found live 2026-09-28, right after the appliance-capacity fix: a search for "Hotpoint Tumble
// Dryer" (no model number) returned an eBay page that was ENTIRELY spare parts — control board,
// motor, drum bearing, heater element, condenser unit, door hinge — none of them caught by
// isNotTheItem, because none of those words were on its list. Real titles, taken verbatim from
// the live response.
import { isNotTheItem } from "../bulkListingFilter";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

const QUERY = "Hotpoint Tumble Dryer";

eq("control board module: not the item", isNotTheItem("Hotpoint Tumble Dryer  Control Board module 21501351500 pcm C00506545", QUERY), true);
eq("motor: not the item", isNotTheItem("Hotpoint Tumble Dryer Nidec MOTOR TCFS 73B", QUERY), true);
eq("condenser unit: not the item", isNotTheItem("HOTPOINT TCFS93 CONDENSER TUMBLE DRYER DOOR fits other models", QUERY), true);
eq("condenser unit cleaned: not the item", isNotTheItem("Hotpoint Tumble Dryer condenser unit TDWSF 83B EP UK GENUINE cleaned", QUERY), true);
eq("drum bearing: not the item", isNotTheItem("Hotpoint Tumble Dryer Rear Drum Bearing for FETC70BP(UK", QUERY), true);
eq("heater element: not the item", isNotTheItem("Hotpoint Creda Tumble dryer Heater Element BAR77 1740940 TD105, TD101 & More", QUERY), true);
eq("door with hinge: not the item", isNotTheItem("Hotpoint Tumble Dryer Door with Hinge TCFS73B", QUERY), true);
eq("door complete with hinge: not the item", isNotTheItem("Hotpoint tumble dryer door complete with hinge/catch", QUERY), true);

// A real whole-unit listing, with none of this vocabulary, must be completely unaffected.
eq("a real whole dryer: is the item", isNotTheItem("Hotpoint 8kg Tumble Dryer White Good Condition", QUERY), false);
eq("a real whole washing machine: is the item", isNotTheItem("Bosch 9kg Washing Machine 1400 Spin Silver", "Bosch Washing Machine"), false);

// Searching for the component itself must still find it (the existing self-correcting rule:
// a word the search itself contains is never held against a listing).
eq("searching for a motor itself keeps a motor listing", isNotTheItem("Hotpoint Tumble Dryer Nidec MOTOR TCFS 73B", "Hotpoint Tumble Dryer Motor"), false);

// A second round of real listings found live, after the first fix: still spares, just with
// words too generic to blacklist for every product (a "switch", "handle", "container", "timer"
// is a completely ordinary thing to mention about countless unrelated whole items) — only caught
// when capacityRatedGoods says this really is appliance territory.
eq("water container: not the item when capacity-rated", isNotTheItem("Hotpoint Tumble Dryer Water Container C00193521", QUERY, true), true);
eq("pump micro switch: not the item when capacity-rated", isNotTheItem("Genuine Hotpoint Indesit Condenser Tumble Dryer Pump Micro Switch C00095596", QUERY, true), true);
eq("water collection drawer: not the item when capacity-rated", isNotTheItem("GENUINE HOTPOINT Tumble Dryer water collection drawer", QUERY, true), true);
eq("heat exchange handle: not the item when capacity-rated", isNotTheItem("Indesit Hotpoint Condenser Tumble Dryer Heat Exchange V1 Handle Only C00258585", QUERY, true), true);
eq("timer: not the item when capacity-rated", isNotTheItem("Hotpoint Small Vented  Tumble Dryer TS13 Timer", QUERY, true), true);

// The whole point of gating this list: without capacityRatedGoods, these same generic words must
// NOT be held against an unrelated whole item — a games console, a suitcase, a lunch box.
eq("a games switch console is unaffected", isNotTheItem("Nintendo Switch OLED Console White", "Nintendo Switch", false), false);
eq("a suitcase with a handle is unaffected", isNotTheItem("Large Suitcase with Telescopic Handle 90L", "Suitcase", false), false);
eq("a lunch container is unaffected", isNotTheItem("Stainless Steel Lunch Container", "Lunch Box", false), false);
// And the same is true even when the flag is simply left out (the default for every ordinary product).
eq("without the flag at all, still unaffected (default)", isNotTheItem("Nintendo Switch OLED Console White", "Nintendo Switch"), false);

// Real whole units from the same live search, correctly kept once the spares are gone.
eq("a real whole dryer with a model number: is the item", isNotTheItem("Hotpoint 9kg Tumble Dryer NTM1192XBUK L52387", QUERY, true), false);
eq("a real whole Aquarius dryer: is the item", isNotTheItem("Hotpoint Aquarius Tumble Dryer 7kg 1400rpm", QUERY, true), false);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
