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

const none = { ebay: null, amazonNew: null, googleNew: null, aiNew: null, aiUsedMin: null, aiUsedMax: null };

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
// No grade/age given, so the defaults (good, within-6-months) apply — median of
// three opinions still lands in the same place either way.
{
  const d = decidePrices({ ...none, used: true, ebay: 150, aiNew: 60, aiUsedMin: 40, aiUsedMax: 50 });
  between("speaker sell", d.sell, 40, 50);
  between("speaker buy", d.buy, 20, 25);
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
  const d = decidePrices({ ...none, used: false, aiNew: 5.99, amazonNew: 2.75, ebay: 3.0 });
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
eq("crisps other flavour rejected", matchesQuery("Walkers Monster Munch Pickled Onion 72g", "Walkers Monster Munch Roast Beef 72g"), false);
eq("crisps same flavour, spaced size", matchesQuery("Monster Munch Roast Beef Walkers 72 g", "Walkers Monster Munch Roast Beef 72g"), true);
eq("lozenges typo-tolerant", matchesQuery("Nicorette Cools 4mg Lozenges Icy Mint", "NICORETTE Icy Mint 4mg Nicotine Lozenges"), true);

// Accessories and spares are not the item
eq("belt clip is an accessory", isNotTheItem("Electric Cordless Drill Belt Hook Clip DeWalt DCD771C2", "DeWalt DCD771 Cordless Drill"), true);
eq("chuck is a spare", isNotTheItem("Chuck for DeWalt Cordless Drill DW959K DCD771C2", "DeWalt DCD771 Cordless Drill"), true);
eq("the drill itself", isNotTheItem("DEWALT DCD771B 20V MAX 1/2 Cordless Drill Driver - TOOL ONLY", "DeWalt DCD771 Cordless Drill"), false);
eq("query word is allowed", isNotTheItem("Padded speaker case", "speaker case"), false);
eq("a case for the speaker", isNotTheItem("JBL Charge 4 Travel Case", "JBL Charge 4 Bluetooth Speaker"), true);

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
