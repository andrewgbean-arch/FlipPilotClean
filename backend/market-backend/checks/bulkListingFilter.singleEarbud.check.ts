// Run with: npx tsx market-backend/checks/bulkListingFilter.singleEarbud.check.ts (from the backend folder).
// A listing for ONE earbud of a pair ("Apple Airpods 2nd Generation Right Side Only A2032") is a part, not the item. Found 10 Nov 2026 on an "Apple AirPods Pro 2nd
// generation" scan with the shop search on: five of the six shop listings that survived filtering were a lone left or right earbud at £25 to £59, so the "typical" price
// was £56 for a pair that sells used for about £100. The titles below are real ones (Google Shopping and eBay used listings). Over 115 live eBay searches (4,998 used
// listings, earbuds, headphones, Joy-Cons, wing mirrors, hearing aids, golf clubs, guitars...) the rule dropped 37 listings and every one was a lone earbud.
import { isNotTheItem, isOneOfAPair } from "../bulkListingFilter";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};

const Q = "Apple AirPods Pro 2nd generation";

// One earbud: dropped.
for (const t of [
  "Apple Airpods 2nd Gen A2032 Right Earbud Only Genuine Apple",
  "Genuine Apple Airpods 2nd Generation Right Side Only A2032",
  "Genuine Apple Airpods 2nd Gen A2032 Right Side Earbud Only,",
  "Apple Airpod 2nd Generation 100% Genuine Left Side Only With Charging",
  "Apple Airpods 2nd Generation 100% Genuine Bluetooth - Left Side Only",
  "Apple Airpods 2nd Generation Right Airpod Only - Model: A3202",
  "Apple Airpods 2nd Generation White With Only Left Headphone Original",
  "Apple Airpods Pro 2nd Generation Left Side A3048 Year 2023 Single",
  "APPLE AIRPODS 2nd Generation A2031 LEFT EARPHONE ONLY GENUINE APPLE",
  "Original Apple Right AirPod only A2032- 2nd Generation For A1602 and A1938 (m)",
  "Apple AirPods 3rd Generation Wireless   RIGHT SIDE ONLY  A2565 ",
  "Apple AirPods Pro 2nd Generation MTJV3ZM/A RIGHT BUD WORKING A3047 GRADE B",
  "Right ear ONLY Beats by Dr. Dre Studio Buds wireless earbud earphones headphones",
  "Jabra Elite 75t active earbud LEFT ear only - BLUE",
  "Genuine Original Samsung Galaxy Buds 2 SM-R177 Right Earbud ONLY - Graphite",
  "Sony WF-1000XM3 Noise Cancelling True Wireless Headphones - Black - LEFT ONLY",
  "Sennheiser Momentum True Wireless 2-in-Ear Headphones Black, Left Earbud",
]) {
  eq(`one earbud: ${t.slice(0, 64)}`, isOneOfAPair(t, Q), true);
  eq(`...so it is not the item: ${t.slice(0, 56)}`, isNotTheItem(t, Q), true);
}

// The pair, or something else entirely: kept.
for (const t of [
  "Apple AirPods Pro 2nd Generation with MagSafe Charging Case",
  "Apple Airpods 2nd Generation White",
  "Apple AirPods Pro 2nd Gen Left & Right Earbuds With Case",
  "Apple AirPods 2nd Gen Left and Right Earbuds",
  "Sony WF-1000XM4 Wireless Noise Cancelling Headphones",
  "Apple AirPods Pro 2nd Generation - Only 2 left in stock",
  "Apple AirPods Pro 2nd Generation, right now only £90",
  "Nintendo Switch Joy-Con Controllers Left Only Neon Red",
  "Ford Focus Wing Mirror Right Side Only",
  "Phonak Hearing Aid Left Ear Only",
  "Callaway Rogue ST Max Driver Left Handed",
  "Bosch Right Angle Drill Attachment",
  "Squier Stratocaster Left Handed Electric Guitar",
]) eq(`kept by the pair rule: ${t.slice(0, 64)}`, isOneOfAPair(t, Q), false);

// The "only the left" wording, where the side is not followed by an earbud word.
eq("only the left one", isOneOfAPair("Apple AirPods Pro 2nd Gen - Only The Left One", Q), true);
eq("only right", isOneOfAPair("Apple AirPods 3rd Generation Only Right Works", Q), true);
// Whole words only: "Bright Side" is not "right side", and "buds" inside "Rosebuds" is not an earbud.
eq("'Bright Side' is not 'right side'", isOneOfAPair("Beats Studio Buds Bright Side Collection", Q), false);
eq("'buds' inside another word is not an earbud", isOneOfAPair("Rosebuds Floral Wreath Right Side Only", "Floral wreath"), false);

// A search that names a side (or a single unit) is looking for one: nothing is held against it.
eq("the search says right", isOneOfAPair("Apple AirPods 2nd Gen Right Earbud Only", "Apple AirPods right earbud"), false);
eq("the search says left", isOneOfAPair("Apple AirPods 2nd Gen Left Side Only", "AirPods Pro left"), false);
eq("the search says single", isOneOfAPair("Apple AirPods 2nd Gen Right Side Only", "single airpod"), false);
eq("and through isNotTheItem", isNotTheItem("Apple AirPods 2nd Gen Right Earbud Only", "Apple AirPods right earbud"), false);

// Odd input.
eq("no title", isOneOfAPair(null, Q), false);
eq("empty title", isOneOfAPair("", Q), false);
eq("no query: a one-sided earbud is still one", isOneOfAPair("Apple Airpods Right Earbud Only", undefined), true);
eq("no query given to isNotTheItem's helper: empty string", isOneOfAPair("Apple Airpods Right Earbud Only", ""), true);

// What the older rules decided is untouched.
eq("a charging case is still not the item", isNotTheItem("Apple AirPods Pro 2nd Generation replacement charging case", Q), true);
eq("a pair of earbuds is still the item", isNotTheItem("Apple Airpods 2nd Generation White", Q), false);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
