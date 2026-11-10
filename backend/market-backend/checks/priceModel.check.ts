// Run with: npx tsx market-backend/checks/priceModel.check.ts (from the backend folder).
import { decidePrices, LISTINGS_THAT_OUTWEIGH_AI_GUESS, NOT_WORKING_SHARE } from "../priceModel";
import { identifyingWords, isNotTheItem, matchesQuery } from "../bulkListingFilter";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { fail++; console.log("FAIL", label, "got", got, "want", want); }
};
const between = (label: string, got: number | null, lo: number, hi: number) => {
  if (got === null || got < lo || got > hi) { fail++; console.log("FAIL", label, "got", got, "want", `${lo}-${hi}`); }
};

const none = { ebay: null, googleNew: null, aiNew: null, aiUsedMin: null, aiUsedMax: null };

// A bag of crisps: Google is full of 18-packs (£18.84), the AI knows the shelf price.
{
  const d = decidePrices({ ...none, used: false, googleNew: 18.84, aiNew: 1.35, ebay: 18.89 });
  between("crisps new", d.newPrice, 1.2, 1.5);
  between("crisps sell", d.sell, 1.0, 1.35);
  between("crisps buy", d.buy, 0.5, 0.7);
}

// Nicotine lozenges (20): eBay scaled per pack is right, the AI agrees.
{
  const d = decidePrices({ ...none, used: false, ebay: 3.48, aiNew: 3.99 });
  between("lozenge new", d.newPrice, 3.4, 4.0);
  between("lozenge sell", d.sell, 3.0, 3.8);
  between("lozenge buy", d.buy, 1.5, 1.9);
}

// A used speaker: market says 150, the AI says 40-50 used, new is about 60.
// No grade/age given, so the defaults (good, within-6-months) apply. The blend of three
// opinions (150, fromNew, 45) would land on the AI's own 45 — but the condition/age ceiling
// (USED_PRICE_UPLIFT_ALLOWED, added after this test was first written) caps a "good" item at
// 6 months at 60 * 0.5 * 0.85 * 1.2 = 30.6 regardless of what the market or the AI's own used
// range implies, so that's what wins here.
{
  const d = decidePrices({ ...none, used: true, ebay: 150, aiNew: 60, aiUsedMin: 40, aiUsedMax: 50 });
  between("speaker sell", d.sell, 30, 31);
  between("speaker buy", d.buy, 15, 15.5);
}

/* --------------------------------------------------
   AI vs real data, far apart, above the cheap-item threshold — the De'Longhi Rivelia case
   found live: real listings genuinely far above a wrong AI guess for an expensive item must
   land BETWEEN the two, not dismiss the real listings outright the way a cheap item does.
-------------------------------------------------- */
{
  // The exact reported numbers: AI says 150, real new listings say 535.50. Google now, not eBay's
  // own new-condition search — see "eBay's own new-condition search plays no part" below.
  const d = decidePrices({ ...none, used: false, googleNew: 535.5, aiNew: 150 });
  if (!(d.newPrice! > 150 && d.newPrice! < 535.5)) {
    fail++;
    console.log("FAIL expensive item lands between AI and real data", d.newPrice);
  }
}
{
  // Just below the cheap-item threshold: still trusts the AI outright, same as crisps.
  const d = decidePrices({ ...none, used: false, googleNew: 60, aiNew: 19 });
  eq("just under the threshold still trusts the AI", d.newPrice, 19);
}
{
  // Just at/above the threshold: blends instead.
  const d = decidePrices({ ...none, used: false, googleNew: 80, aiNew: 20 });
  if (!(d.newPrice! > 20)) {
    fail++;
    console.log("FAIL at the threshold, blends rather than trusting the AI alone", d.newPrice);
  }
}
{
  // The AI and real data still roughly agreeing (within 2x) is untouched by any of this —
  // this only ever fires once they're far enough apart to disagree in the first place.
  const d = decidePrices({ ...none, used: false, googleNew: 250, aiNew: 200 });
  eq("still agreeing: averaged as before", d.newPrice, 225);
}

/* --------------------------------------------------
   eBay's own "new condition" search plays NO part in the new/retail price any more (the owner's
   call, 2026-09-29): it was the repeated troublemaker today (Vitamix, Aeron chair — both real
   premium items, both badly polluted even after real filtering work). Google drives it instead;
   eBay's used listings still drive the Sell/resale price exactly as before (a real, separate
   test — "polluted used listings" below — already covers that eBay side is untouched).
-------------------------------------------------- */
{
  // eBay's own new-condition search says something wildly different from everything else — must
  // be completely ignored for the new price, not blended in even a little.
  const withEbayNew = decidePrices({ ...none, used: false, ebayNew: 16.33, aiNew: 20 });
  const withoutEbayNew = decidePrices({ ...none, used: false, aiNew: 20 });
  eq("ebayNew alone, with nothing else, is simply ignored", withEbayNew.newPrice, withoutEbayNew.newPrice);
  eq("...landing on the AI's own guess, not a contaminated blend", withEbayNew.newPrice, 20);
}
{
  // The exact real numbers reported: a garbage ebayNew must not drag a good Google figure down
  // (or up) at all — the answer is identical whether ebayNew is present or completely absent.
  const withEbayNew = decidePrices({ ...none, used: false, ebayNew: 86.94, googleNew: 15, aiNew: 15 });
  const withoutEbayNew = decidePrices({ ...none, used: false, googleNew: 15, aiNew: 15 });
  eq("a contaminated ebayNew alongside a good googleNew changes nothing", withEbayNew.newPrice, withoutEbayNew.newPrice);
}

// A used speaker where the market and the AI agree: the market wins.
{
  const d = decidePrices({ ...none, used: true, ebay: 55, aiNew: 130, aiUsedMin: 40, aiUsedMax: 70 });
  eq("agree: market wins", d.sell, 55);
}

// Never sell a used item for more than it costs new.
{
  const d = decidePrices({ ...none, used: true, ebay: 100, aiNew: 60, aiUsedMin: 80, aiUsedMax: 120 });
  between("capped by new", d.sell, 0, 54.01);
}

// Nothing at all
{
  const d = decidePrices({ ...none, used: true });
  eq("nothing", d.sell, null);
  eq("nothing buy", d.buy, null);
}

// Only the AI knows. Two opinions (fromNew via the default age/grade, and the AI's
// own used range) that roughly agree average out.
{
  const d = decidePrices({ ...none, used: true, aiNew: 100, aiUsedMin: 30, aiUsedMax: 50 });
  between("ai only sell", d.sell, 39, 43);
}

// Lozenges where the AI is a bit high and the listings (scaled from 80-packs) a bit low.
{
  const d = decidePrices({ ...none, used: false, aiNew: 5.99, googleNew: 2.75, ebay: 3.0 });
  between("lozenge new between", d.newPrice, 3.5, 4.5);
  eq("lozenge sell from ebay", d.sell, 3);
}

/* --------------------------------------------------
   CONDITION (Perfect / Good / Poor / Not working) — the two held equal
   at age "new" (factor 1) so only the condition share is being compared.
-------------------------------------------------- */
{
  const base = { ...none, used: true, age: "new" as const, googleNew: 130, ebayNew: 120, aiNew: 125 };
  const perfect = decidePrices({ ...base, grade: "perfect" });
  const good = decidePrices({ ...base, grade: "good" });
  const poor = decidePrices({ ...base, grade: "poor" });

  between("condition good", good.sell, 55, 70);
  between("condition poor: lower than good", poor.sell, 30, 45);
  between("condition perfect: higher than good", perfect.sell, 80, 95);
  if (!(perfect.sell! > good.sell! && good.sell! > poor.sell!)) {
    fail++;
    console.log("FAIL condition ordering", { perfect: perfect.sell, good: good.sell, poor: poor.sell });
  }
}

/* --------------------------------------------------
   AGE (New / Like new / Within 6 months / Older than 1 year) — condition held
   equal at "good" so only the age discount is being compared.
-------------------------------------------------- */
{
  const base = { ...none, used: true, grade: "good" as const, googleNew: 100, ebayNew: 100, aiNew: 100 };
  const fresh = decidePrices({ ...base, age: "new" });
  const likeNew = decidePrices({ ...base, age: "like-new" });
  const sixMonths = decidePrices({ ...base, age: "within-6-months" });
  const overYear = decidePrices({ ...base, age: "over-1-year" });

  between("age new: no extra discount", fresh.sell, 48, 52);
  between("age like-new: a touch less", likeNew.sell, 45, 49);
  between("age within 6 months: noticeably less", sixMonths.sell, 40, 44);
  between("age over a year: the least", overYear.sell, 30, 35);
  if (!(fresh.sell! > likeNew.sell! && likeNew.sell! > sixMonths.sell! && sixMonths.sell! > overYear.sell!)) {
    fail++;
    console.log("FAIL age ordering", {
      fresh: fresh.sell,
      likeNew: likeNew.sell,
      sixMonths: sixMonths.sell,
      overYear: overYear.sell,
    });
  }
}

/* --------------------------------------------------
   NOT WORKING — priced for spares/repair; ignores a market/AI number that
   assumes the item works, and age doesn't discount it further.
-------------------------------------------------- */
{
  // A far higher used-market price (150) and AI range (100-140) are both ignored:
  // this is spares value, about 12% of the ~200 new price either would suggest.
  const d = decidePrices({
    ...none,
    used: true,
    grade: "not-working",
    googleNew: 200,
    ebayNew: 200,
    aiNew: 200,
    ebay: 150,
    aiUsedMin: 100,
    aiUsedMax: 140,
  });
  between("not working: priced for parts, not the market figure", d.sell, 20, 28);
}
{
  // No new price to work from at all: falls back to a share of the (working)
  // used listing rather than being left unpriced.
  const d = decidePrices({ ...none, used: true, grade: "not-working", ebay: 100 });
  eq("not working, no new price", d.sell, Number((100 * NOT_WORKING_SHARE).toFixed(2)));
}

// Used listings polluted with new ones: new price and the AI outvote them.
{
  const d = decidePrices({ ...none, used: true, grade: "good", ebay: 150, googleNew: 130, ebayNew: 125, aiNew: 120, aiUsedMin: 40, aiUsedMax: 60 });
  between("polluted used listings", d.sell, 50, 65);
}

// Same product, not the next model up
eq("charge 4 words", identifyingWords("JBL Charge 4 Bluetooth Speaker").join(","), "jbl,charge,4");
eq("match same model", matchesQuery("JBL Charge 4 Portable Waterproof Speaker Black", "JBL Charge 4 Bluetooth Speaker"), true);
eq("reject charge 5", matchesQuery("JBL Charge 5 Portable Bluetooth Speaker", "JBL Charge 4 Bluetooth Speaker"), false);
eq("reject xtreme 4", matchesQuery("JBL Xtreme 4 Portable Speaker", "JBL Charge 4 Bluetooth Speaker"), false);
eq("generic query matches all", matchesQuery("Anything Bluetooth Speaker", "Portable Bluetooth Speaker"), true);

// Found live 2026-09-28: "espresso"/"machine"/"coffee" were treated as required identifying
// words, so a genuine De'Longhi Rivelia listing that said "coffee machine" instead of "espresso
// machine" — a completely ordinary synonym — failed to match its own product, while a totally
// different, much cheaper De'Longhi model (that happened to also say "espresso...machine") could
// still slip through on a weaker match. Only the brand and model name should be required.
eq("rivelia words", identifyingWords("De'Longhi Rivelia Espresso Machine").join(","), "longhi,rivelia");
eq(
  "a real Rivelia listing worded differently still matches",
  matchesQuery("De'Longhi Delonghi Rivelia Bean to Cup Coffee Machine", "De'Longhi Rivelia Espresso Machine"),
  true
);
eq(
  "a different, cheaper De'Longhi model is rejected",
  matchesQuery("De'Longhi Delonghi Stilosa EC260 Espresso Coffee Machine", "De'Longhi Rivelia Espresso Machine"),
  false
);
eq("crisps other flavour rejected", matchesQuery("Walkers Monster Munch Pickled Onion 72g", "Walkers Monster Munch Roast Beef 72g"), false);
eq("crisps same flavour, spaced size", matchesQuery("Monster Munch Roast Beef Walkers 72 g", "Walkers Monster Munch Roast Beef 72g"), true);
eq("lozenges typo-tolerant", matchesQuery("Nicorette Cools 4mg Lozenges Icy Mint", "NICORETTE Icy Mint 4mg Nicotine Lozenges"), true);

// Accessories and spares are not the item
eq("belt clip is an accessory", isNotTheItem("Electric Cordless Drill Belt Hook Clip DeWalt DCD771C2", "DeWalt DCD771 Cordless Drill"), true);
eq("chuck is a spare", isNotTheItem("Chuck for DeWalt Cordless Drill DW959K DCD771C2", "DeWalt DCD771 Cordless Drill"), true);
eq("the drill itself", isNotTheItem("DEWALT DCD771B 20V MAX 1/2 Cordless Drill Driver - TOOL ONLY", "DeWalt DCD771 Cordless Drill"), false);
eq("query word is allowed", isNotTheItem("Padded speaker case", "speaker case"), false);
eq("a case for the speaker", isNotTheItem("JBL Charge 4 Travel Case", "JBL Charge 4 Bluetooth Speaker"), true);

/* --------------------------------------------------
   ROUNDING — "£134.31" is never what a real listing is priced at; and buy (half of sell) has
   to be worked out from the SAME rounded number the app shows, not a hidden unrounded one.
   A single ebay opinion with nothing else keeps this isolated from the new-price/ceiling
   maths above (already covered by its own tests) — just the raw sell going into rounding.
-------------------------------------------------- */
{
  // A real reported case: an appliance rounds up to a whole pound, never down.
  const d = decidePrices({ ...none, used: true, ebay: 134.2 });
  eq("appliance sell rounds up to a whole pound", d.sell, 135);
  eq("buy is worked out from the rounded sell, not the raw 134.xx", d.buy, 67.5);
}
{
  // A cheap item is rounded far more gently — to the nearest 10p, not a flat whole pound (which
  // would turn £1.2x into £2.00, a 67% jump for something this cheap).
  const d = decidePrices({ ...none, used: true, ebay: 1.23 });
  eq("a cheap item rounds to the nearest 10p, not a whole pound", d.sell, 1.3);
}
{
  // A mid-range item rounds to the nearest 50p.
  const d = decidePrices({ ...none, used: true, ebay: 31.2 });
  eq("a mid-range item rounds to the nearest 50p", d.sell, 31.5);
}
{
  // Never rounds DOWN — a price already sitting exactly on a step is left alone, not
  // pushed to the next one up.
  const d = decidePrices({ ...none, used: true, ebay: 40 });
  eq("a price already on a clean step is left alone", d.sell, 40);
}

/* --------------------------------------------------
   A SOLID PILE OF REAL USED LISTINGS KEEPS THE PRICE HONEST (see LISTINGS_CEILING)
-------------------------------------------------- */
{
  // A Galaxy S21 priced with no Google shelf price (found 18 Oct 2026): 48 real used listings average 138.58, but the
  // AI's stale idea of a new one (700) fed BOTH the new-price rule of thumb and its own used range, so two opinions
  // that are really one outvoted the listings and the sell price came out at 298.
  const d = decidePrices({ ...none, used: true, ebay: 138.58, ebayListings: 48, aiNew: 699.99, aiUsedMin: 350, aiUsedMax: 500 });
  between("48 real listings keep an S21 near them, not near the AI's stale guess", d.sell, 138.58, 208);
  eq("buy is still half the (capped) sell", d.buy, (d.sell as number) / 2);
}
{
  // The same evidence with fewer listings than the rule needs is left exactly as before.
  const d = decidePrices({ ...none, used: true, ebay: 138.58, ebayListings: 9, aiNew: 699.99, aiUsedMin: 350, aiUsedMax: 500 });
  eq("9 listings are not enough to override the other opinions", d.sell, 298);
  const unknown = decidePrices({ ...none, used: true, ebay: 138.58, aiNew: 699.99, aiUsedMin: 350, aiUsedMax: 500 });
  eq("no listing count is the same as before", unknown.sell, 298);
}
{
  // Exactly 10 listings is enough.
  const d = decidePrices({ ...none, used: true, ebay: 138.58, ebayListings: 10, aiNew: 699.99, aiUsedMin: 350, aiUsedMax: 500 });
  eq("10 listings is enough", d.sell, 208);
}
{
  // A DVD box set: 31 listings average 9.72, Google's shelf price is for a new Blu-ray collection (87.30), the AI says
  // 49.99 new and 20-35 used. It came out at 27.50.
  const d = decidePrices({ ...none, used: true, ebay: 9.72, ebayListings: 31, googleNew: 87.3, aiNew: 49.99, aiUsedMin: 20, aiUsedMax: 35 });
  eq("a DVD box set stays near its listings", d.sell, 15);
}
{
  // The ceiling never RAISES a price: a vinyl record whose other opinions are LOWER than a big pile of listings is left alone.
  const withListings = decidePrices({ ...none, used: true, ebay: 52.96, ebayListings: 20, googleNew: 35, aiNew: 25, aiUsedMin: 10, aiUsedMax: 20 });
  const without = decidePrices({ ...none, used: true, ebay: 52.96, googleNew: 35, aiNew: 25, aiUsedMin: 10, aiUsedMax: 20 });
  eq("the ceiling does not lift a price", withListings.sell, without.sell);
}
{
  // A broken item is priced for spares or repair; the listings (working ones) are not its ceiling.
  const d = decidePrices({ ...none, used: true, grade: "not-working", ebay: 20, ebayListings: 40, aiNew: 400 });
  eq("a not-working item ignores the ceiling", d.sell, 48);
}

// An AI that says it does not know the item is not heard when the title names a model and real listings are plentiful.
// A typed "Duotts C29" (an e-bike of about £800 new): 11 matching shop listings (typical £899, cheapest £499.99), none on eBay used, and an AI that did not know the
// brand and said £50 new, £15-25 used. It came out at £213 (the AI pulled the blend to £212, then the cheapest shop listing lifted it back to £499.99 as "new").
{
  const duotts = { ...none, used: true, ebayListings: 0, googleNew: 899, aiNew: 50, aiUsedMin: 15, aiUsedMax: 25, marketFloor: 499.99 };
  const before = decidePrices(duotts);
  eq("duotts, nothing said about the AI: as before", before.sell, 213);
  const d = decidePrices({ ...duotts, aiRecognised: false, namedModel: true, googleListings: 11 });
  eq("duotts: the AI that does not know it is set aside, the shop price stands", d.newPrice, 899);
  eq("duotts: a used one is worked from it", d.sell, 383);
  eq("duotts: buy is half", d.buy, 191.5);

  // Only an AI that SAID it does not know, and only with a model named.
  eq("the AI knows it: as before", decidePrices({ ...duotts, aiRecognised: true, namedModel: true, googleListings: 11 }).sell, 213);
  eq("the AI did not say: as before", decidePrices({ ...duotts, aiRecognised: null, namedModel: true, googleListings: 11 }).sell, 213);
  eq("no model named in the title: as before", decidePrices({ ...duotts, aiRecognised: false, namedModel: false, googleListings: 11 }).sell, 213);
  eq("model naming not reported: as before", decidePrices({ ...duotts, aiRecognised: false, googleListings: 11 }).sell, 213);
  eq("sold as new, not used: as before", decidePrices({ ...duotts, used: false, aiRecognised: false, namedModel: true, googleListings: 11 }).sell,
    decidePrices({ ...duotts, used: false }).sell);

  // How many listings: 10 is where it starts (the same figure as the app's STRONG_LISTINGS), shop and eBay counted together.
  eq("9 listings: the AI still takes part", decidePrices({ ...duotts, aiRecognised: false, namedModel: true, googleListings: 9 }).sell, 213);
  eq("10 listings: it does not", decidePrices({ ...duotts, aiRecognised: false, namedModel: true, googleListings: 10 }).sell, 383);
  eq("4 used + 6 shop listings count together", decidePrices({ ...duotts, aiRecognised: false, namedModel: true, ebayListings: 4, googleListings: 6 }).sell, 383);
  eq("4 used + 5 shop listings do not", decidePrices({ ...duotts, aiRecognised: false, namedModel: true, ebayListings: 4, googleListings: 5 }).sell, 213);
  eq("the threshold is 10", LISTINGS_THAT_OUTWEIGH_AI_GUESS, 10);

  // The AI's USED range goes with its new price: with a used listing price present, the AI's £20 midpoint would be the middle of three opinions (100, 383, 20) and
  // win; set aside, the two left disagree and the one worked from the shop price stands.
  const withUsed = { ...duotts, ebay: 100, aiRecognised: false, namedModel: true, googleListings: 11 };
  eq("the AI's used range is set aside too", decidePrices(withUsed).sell, 383);
  eq("without that, the AI's used range outvotes the shop price", decidePrices({ ...withUsed, aiRecognised: true }).sell, 100);
  eq("a used maximum on its own does not bring it back", decidePrices({ ...withUsed, aiUsedMin: null }).sell, 383);
}
{
  // "Pine chest of drawers": no model named. The AI says it does not know it only because there is no make and model to know; 42 used eBay listings have a middle
  // asking price of about £312 (large and antique chests, asks that include delivery), the AI says £50-100 used. Tried without the model-name gate this moved
  // from £107 to £281: the lesson of 18 Oct 2026 (a floor from eBay alone makes things worse) again.
  const pine = { ...none, used: true, ebay: 280.8, ebayListings: 42, aiNew: 250, aiUsedMin: 50, aiUsedMax: 100 };
  eq("pine chest, as before", decidePrices(pine).sell, 107);
  eq("pine chest: no model named, the AI is still heard", decidePrices({ ...pine, aiRecognised: false, namedModel: false, googleListings: 0 }).sell, 107);
  eq("pine chest: the gate is what keeps it there", decidePrices({ ...pine, aiRecognised: false, namedModel: true, googleListings: 0 }).sell !== 107, true);
}
{
  // An item the AI knows is left alone whatever the listings say (an Xbox Series S: eBay asks £277 for used ones, shops £390 new, it really sells for about £170).
  const xbox = { ...none, used: true, ebay: 276.75, ebayListings: 28, googleNew: 389.99, aiNew: 249.99, aiUsedMin: 150, aiUsedMax: 200, marketFloor: 259.99 };
  eq("an item the AI knows is unchanged", decidePrices({ ...xbox, aiRecognised: true, namedModel: true, googleListings: 33 }).sell, decidePrices(xbox).sell);
}

// The condition ceiling (about half the new price) stands aside for goods that hold their value: when 10+ used listings AND the AI's own used range both put a used one above it,
// it is scaled up to the lower of the two (the same factor for every Condition and Age box). Found 10 Nov 2026 with real figures from a Brompton, a Rolex, an Xbox and a PS5 Pro.
{
  const rolex = { ...none, used: true, ebay: 7666.52, ebayListings: 38, aiNew: 8000, aiUsedMin: 6000, aiUsedMax: 9000 };
  eq("rolex: priced from the evidence (was 4,080: the ceiling set it)", decidePrices(rolex).sell, 7500);
  const brompton = { ...none, used: true, ebay: 877.21, ebayListings: 29, aiNew: 1200, aiUsedMin: 600, aiUsedMax: 900 };
  eq("brompton M6L: 750 (was 612)", decidePrices(brompton).sell, 750);
  const xbox = { ...none, used: true, ebay: 281.43, ebayListings: 27, aiNew: 249.99, aiUsedMin: 150, aiUsedMax: 200 };
  eq("xbox series s: 175 (was 128; a used one sells for about 170)", decidePrices(xbox).sell, 175);
  const ps5pro = { ...none, used: true, ebay: 854.91, ebayListings: 28, aiNew: 499.99, aiUsedMin: 350, aiUsedMax: 450 };
  eq("ps5 pro: 400, the lower of eBay's 855 and the AI's 400 (was 255)", decidePrices(ps5pro).sell, 400);

  // The boxes keep working, and keep their order, for an item that holds its value.
  const grades = ["perfect", "good", "poor"] as const;
  const ages = ["like-new", "within-6-months", "over-1-year"] as const;
  for (const [name, item] of [["rolex", rolex], ["brompton", brompton], ["xbox", xbox], ["ps5 pro", ps5pro]] as const) {
    for (const age of ages) {
      const prices = grades.map((grade) => decidePrices({ ...item, grade, age }).sell as number);
      eq(`${name}, ${age}: Perfect is not below Good, Good is not below Poor`, prices[0] >= prices[1] && prices[1] >= prices[2], true);
    }
    for (const grade of grades) {
      const prices = ages.map((age) => decidePrices({ ...item, grade, age }).sell as number);
      eq(`${name}, ${grade}: Like new is not below Within 6 months, which is not below Older`, prices[0] >= prices[1] && prices[1] >= prices[2], true);
    }
    eq(`${name}: Poor is clearly below Good`, (decidePrices({ ...item, grade: "poor" }).sell as number) < (decidePrices({ ...item, grade: "good" }).sell as number), true);
    eq(`${name}: Older than 1 year is clearly below Within 6 months`, (decidePrices({ ...item, age: "over-1-year" }).sell as number) < (decidePrices({ ...item, age: "within-6-months" }).sell as number), true);
  }
  eq("rolex, Poor and Older than 1 year", decidePrices({ ...rolex, grade: "poor", age: "over-1-year" }).sell, 3442);

  // It needs BOTH: used listings (10 or more) and the AI's used range above the ceiling.
  eq("9 listings: the ceiling stays (a Brompton P Line, eBay 1,800, AI 1,000-1,200)", decidePrices({ ...none, used: true, ebay: 1800, ebayListings: 9, aiNew: 1600, aiUsedMin: 1000, aiUsedMax: 1200 }).sell, 816);
  eq("10 listings: it stands aside", decidePrices({ ...none, used: true, ebay: 1800, ebayListings: 10, aiNew: 1600, aiUsedMin: 1000, aiUsedMax: 1200 }).sell, 1100);
  eq("no listing count: the ceiling stays", decidePrices({ ...none, used: true, ebay: 877.21, aiNew: 1200, aiUsedMin: 600, aiUsedMax: 900 }).sell, 612);
  eq("the AI's used range is below the ceiling: it stays (a pine chest of drawers, eBay 42 listings at £312, AI 50-100)",
    decidePrices({ ...none, used: true, ebay: 280.8, ebayListings: 42, aiNew: 250, aiUsedMin: 50, aiUsedMax: 100 }).sell, 107);
  eq("eBay is below the ceiling: it stays (510, the same as with too few listings to count)",
    decidePrices({ ...none, used: true, ebay: 500, ebayListings: 20, aiNew: 1200, aiUsedMin: 800, aiUsedMax: 1000 }).sell, 510);
  eq("...and is not different from the answer with 9 listings",
    decidePrices({ ...none, used: true, ebay: 500, ebayListings: 20, aiNew: 1200, aiUsedMin: 800, aiUsedMax: 1000 }).sell,
    decidePrices({ ...none, used: true, ebay: 500, ebayListings: 9, aiNew: 1200, aiUsedMin: 800, aiUsedMax: 1000 }).sell);
  eq("no AI used range at all: the ceiling stays", decidePrices({ ...none, used: true, ebay: 877.21, ebayListings: 29, aiNew: 1200 }).sell, 612);
  eq("only the AI's used maximum (900): counts as its used range", decidePrices({ ...none, used: true, ebay: 877.21, ebayListings: 29, aiNew: 1200, aiUsedMax: 900 }).sell, 878);

  // Not for an item priced for spares or repair, and not for a sealed one.
  eq("not working: untouched", decidePrices({ ...rolex, grade: "not-working" }).sell, decidePrices({ ...rolex, ebayListings: 9, grade: "not-working" }).sell);
  eq("sold as new: untouched", decidePrices({ ...rolex, used: false }).sell, decidePrices({ ...rolex, used: false, ebayListings: 9 }).sell);

  // Never above the lower of the two sources at the usual boxes (or what the usual ceiling already allowed), over a grid of items.
  let over = 0;
  let checked = 0;
  for (const ebay of [60, 150, 400, 900, 2500]) {
    for (const aiMid of [40, 120, 350, 800, 3000]) {
      for (const aiNew of [80, 250, 700, 2000, 8000]) {
        const d = decidePrices({ ...none, used: true, ebay, ebayListings: 15, aiNew, aiUsedMin: aiMid * 0.9, aiUsedMax: aiMid * 1.1 });
        const bound = Math.ceil(Math.max(Math.min(ebay, aiMid), aiNew * 0.51) + 1);
        checked++;
        if ((d.sell as number) > bound) { over++; console.log("over the bound:", { ebay, aiMid, aiNew, sell: d.sell, bound }); }
      }
    }
  }
  eq(`${checked} combinations: never above the lower of eBay and the AI's used range, or the usual ceiling`, over, 0);
}

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
