// Run with: npx tsx market-backend/checks/priceModel.check.ts (from the backend folder).
import { decidePrices, NOT_WORKING_SHARE } from "../priceModel";
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

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
