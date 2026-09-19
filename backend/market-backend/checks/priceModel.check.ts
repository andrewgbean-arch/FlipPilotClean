// Run with: npx tsx market-backend/checks/priceModel.check.ts (from the backend folder).
import { decidePrices } from "../priceModel";
import { identifyingWords, matchesQuery } from "../bulkListingFilter";

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

// Only the AI knows
{
  const d = decidePrices({ ...none, used: true, aiNew: 100, aiUsedMin: 30, aiUsedMax: 50 });
  eq("ai only sell", d.sell, 45);
}


// Lozenges where the AI is a bit high and the listings (scaled from 80-packs) a bit low.
{
  const d = decidePrices({ ...none, used: false, aiNew: 5.99, amazonNew: 2.75, ebay: 3.0 });
  between("lozenge new between", d.newPrice, 3.5, 4.5);
  eq("lozenge sell from ebay", d.sell, 3);
}


// Used price worked out from the new price: nothing on used listings at all.
{
  const d = decidePrices({ ...none, used: true, grade: "good", googleNew: 130, ebayNew: 120, aiNew: 125 });
  between("from new: good is about half", d.sell, 55, 70);
  const poor = decidePrices({ ...none, used: true, grade: "poor", googleNew: 130, ebayNew: 120, aiNew: 125 });
  between("from new: poor is lower", poor.sell, 20, 30);
  const likeNew = decidePrices({ ...none, used: true, grade: "like new", googleNew: 130, ebayNew: 120, aiNew: 125 });
  between("from new: like new is higher", likeNew.sell, 80, 95);
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

console.log(fail === 0 ? "ALL PASS" : `${fail} FAILED`);
process.exit(fail ? 1 : 0);
