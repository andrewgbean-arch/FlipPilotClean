// Run with: npx tsx src/utils/checks/ebayListings.check.ts (from the app root).
// The "On eBay right now" block under a scan result's prices (src/components/scan/EbayListings.tsx) shows eBay's own
// listings as cards. eBay's API licence allows that on conditions, and each is a check here: the cards are kept
// apart from everything we calculate, never cheaper or dearer than the From and To above them, never a listing that
// was scaled to a different pack size, only ever eBay's own pages as links, and the whole block goes once the
// listings are older than five hours (eBay allows six). Before this, the old "Trending on eBay" card printed the
// same £40.52 to £165.00 that the price track had already been refused for (an electric mountain bike priced at
// £510 whose eBay search had caught brake sets and tyres).
import { clockTime, ebayRangeToShow, isEbayCheckFresh, pickEbayCards, safeEbayLink, safeImageUrl, EBAY_FRESH_MS } from "../ebayListings";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log("FAIL", label, "got", JSON.stringify(got), "want", JSON.stringify(want)); }
};

// One listing the way the server sends it (backend/market-backend/ebayBrowseApi.ts).
let n = 0;
const listing = (title: string, price: number, extra: Record<string, unknown> = {}): Record<string, any> => {
  n++;
  return {
    title,
    price: `£${price.toFixed(2)}`,
    extracted_price: price,
    thumbnail: `https://i.ebayimg.com/images/g/pic${n}/s-l225.jpg`,
    link: `https://www.ebay.co.uk/itm/${1000 + n}?hash=item${n}`,
    condition: "Used",
    ...extra,
  };
};
const market = (prices: number[], extra: Record<string, unknown> = {}): { ebay: Record<string, number>; ebayItems: Record<string, any>[] } => ({
  ebay: { lowest: Math.min(...prices), highest: Math.max(...prices), soldCount: prices.length },
  ebayItems: prices.map((p) => listing(`Item at ${p}`, p)),
  ...extra,
});
const pricesOf = (cards: { price: number }[]) => cards.map((c) => c.price);

// ---- pickEbayCards: which listings become cards ----
{
  const cards = pickEbayCards(market([20, 25, 30, 35, 40, 45, 50, 60]));
  eq("five cards at most", cards.length, 5);
  // The middle of 20..60 is 37.5; the five nearest are 25, 30, 35, 40 and 45, shown cheapest first.
  eq("the five nearest the typical price, in price order", pricesOf(cards), [25, 30, 35, 40, 45]);
  eq("a card carries its own title, price, picture, link and condition", cards[0], {
    title: "Item at 25",
    price: 25,
    image: "https://i.ebayimg.com/images/g/pic2/s-l225.jpg",
    link: "https://www.ebay.co.uk/itm/1002?hash=item2",
    condition: "Used",
  });
}
eq("fewer listings than the limit: all of them, cheapest first", pricesOf(pickEbayCards(market([30, 10, 20]))), [10, 20, 30]);
eq("the limit can be changed", pickEbayCards(market([1, 2, 3, 4, 5, 6, 7]), 3).length, 3);

// Listings the range threw out as outliers must not show as cards cheaper or dearer than the From and To.
{
  const m = market([20, 30, 40]);
  m.ebayItems.push(listing("Spare part", 5), listing("Bundle", 400));
  eq("outliers outside From and To are left out", pricesOf(pickEbayCards(m)), [20, 30, 40]);
}

// A listing that states its own pack size is scaled by the server to the pack scanned; the card must show what
// the listing really costs, so it is left out.
{
  const m = market([10, 12, 14]);
  m.ebayItems.push(listing("Pack of 6", 18, { extracted_price: 3 }));
  eq("a pack-scaled listing is left out", pricesOf(pickEbayCards(m)), [10, 12, 14]);
}

// Links: only eBay's own pages, over https.
{
  const bad = [
    "http://www.ebay.co.uk/itm/1",
    "https://www.ebay.co.uk.evil.example/itm/1",
    "https://evilebay.com/itm/1",
    "https://ebay.com@evil.example/itm/1",
    "javascript:alert(1)",
    "https://example.com/?u=https://www.ebay.co.uk/itm/1",
    "",
    null,
    42,
  ];
  for (const link of bad) {
    const m = market([10, 12]);
    m.ebayItems.push(listing("Sneaky", 11, { link }));
    eq(`link ${JSON.stringify(link)} gives no card`, pricesOf(pickEbayCards(m)), [10, 12]);
  }
  eq("eBay UK page accepted", safeEbayLink("https://www.ebay.co.uk/itm/123?hash=x"), "https://www.ebay.co.uk/itm/123?hash=x");
  eq("bare eBay UK domain accepted", safeEbayLink("https://ebay.co.uk/"), "https://ebay.co.uk/");
  eq("eBay .com page accepted", safeEbayLink("https://www.ebay.com/itm/1"), "https://www.ebay.com/itm/1");
  eq("lookalike refused", safeEbayLink("https://notebay.co.uk/"), null);
  eq("https picture accepted", safeImageUrl("https://i.ebayimg.com/a.jpg"), "https://i.ebayimg.com/a.jpg");
  eq("http picture refused", safeImageUrl("http://i.ebayimg.com/a.jpg"), null);
}

// The same listing twice (its link carries tracking after the "?") is one card.
{
  const m = market([10, 20]);
  m.ebayItems.push({ ...m.ebayItems[0], link: `${String(m.ebayItems[0].link).split("?")[0]}?hash=other` });
  eq("a duplicate listing is one card", pricesOf(pickEbayCards(m)), [10, 20]);
}

// Pictures: kept when missing, but preferred when there are enough with one.
{
  const m = market([10, 20, 30]);
  m.ebayItems[1] = { ...m.ebayItems[1], thumbnail: null };
  const cards = pickEbayCards(m);
  eq("a listing without a picture still shows", pricesOf(cards), [10, 20, 30]);
  eq("its card has no picture", cards[1].image, null);
}
{
  const m = market([20, 21, 22, 23, 24, 25, 26]);
  m.ebayItems[3] = { ...m.ebayItems[3], thumbnail: null }; // the middle one has none
  const cards = pickEbayCards(m);
  eq("with six pictured listings, the one without a picture is passed over", cards.every((c) => c.image != null), true);
}

// Condition: tidied, empty becomes null.
{
  const m = market([10, 20]);
  m.ebayItems[0] = { ...m.ebayItems[0], condition: "  Pre-owned  " };
  m.ebayItems[1] = { ...m.ebayItems[1], condition: "   " };
  const cards = pickEbayCards(m);
  eq("condition is trimmed", cards[0].condition, "Pre-owned");
  eq("an empty condition is null", cards[1].condition, null);
}

// Nothing usable gives no cards, never a throw.
eq("no market", pickEbayCards(null), []);
eq("no eBay range", pickEbayCards({ ebayItems: [listing("x", 10)] }), []);
eq("listings not an array", pickEbayCards({ ebay: { lowest: 1, highest: 9 }, ebayItems: "nope" }), []);
eq("listing entries that are not objects", pickEbayCards({ ebay: { lowest: 1, highest: 9 }, ebayItems: [null, 3, "x"] }), []);
eq("eBay's own item list is used when the top-level one is missing", pricesOf(pickEbayCards({ ebay: { lowest: 10, highest: 20, items: [listing("a", 10), listing("b", 20)] } })), [10, 20]);
{
  const m = market([10, 20, 30]);
  const before = JSON.stringify(m);
  pickEbayCards(m);
  eq("the reply is not changed", JSON.stringify(m), before);
}

// ---- ebayRangeToShow: when the block is drawn at all ----
eq("speaker: £57 inside eBay £44.99 to £165", ebayRangeToShow({ lowest: 44.99, highest: 165 }, 57), { low: 44.99, high: 165 });
eq("e-bike: £510 is far above eBay's £40.52 to £165, so no block", ebayRangeToShow({ lowest: 40.52, highest: 165 }, 510), null);
eq("£1.30 under eBay's £2.40 to £8.70: no block", ebayRangeToShow({ lowest: 2.4, highest: 8.7 }, 1.3), null);
eq("just outside an end (10%) still counts as inside", ebayRangeToShow({ lowest: 10, highest: 20 }, 9.5), { low: 10, high: 20 });
eq("no Fair market price: nothing contradicts the range", ebayRangeToShow({ lowest: 5, highest: 9 }, null), { low: 5, high: 9 });
eq("a price in a string is not trusted as a price", ebayRangeToShow({ lowest: 5, highest: 9 }, "£7"), { low: 5, high: 9 });
eq("one listing (From equals To) is allowed", ebayRangeToShow({ lowest: 12, highest: 12 }, 11), { low: 12, high: 12 });
eq("reversed range: no block", ebayRangeToShow({ lowest: 20, highest: 10 }, 15), null);
eq("zero low end: no block", ebayRangeToShow({ lowest: 0, highest: 10 }, 5), null);
eq("only one end: no block", ebayRangeToShow({ lowest: 5, highest: null }, 5), null);
eq("strings and NaN: no block", ebayRangeToShow({ lowest: "5", highest: NaN }, 5), null);
eq("no eBay data: no block", ebayRangeToShow(null, 5), null);

// ---- isEbayCheckFresh: the five-hour limit ----
{
  const now = 1_000_000_000_000;
  const H = 60 * 60 * 1000;
  eq("five hours is the limit", EBAY_FRESH_MS, 5 * H);
  eq("just checked", isEbayCheckFresh(now, now), true);
  eq("an hour old", isEbayCheckFresh(now - H, now), true);
  eq("exactly five hours old", isEbayCheckFresh(now - 5 * H, now), true);
  eq("a millisecond past five hours", isEbayCheckFresh(now - 5 * H - 1, now), false);
  eq("a day old", isEbayCheckFresh(now - 24 * H, now), false);
  eq("no time at all", isEbayCheckFresh(null, now), false);
  eq("undefined", isEbayCheckFresh(undefined, now), false);
  eq("a string is not a time", isEbayCheckFresh(String(now), now), false);
  eq("a clock a minute behind is forgiven", isEbayCheckFresh(now + 60_000, now), true);
  eq("ten minutes in the future is not", isEbayCheckFresh(now + 10 * 60_000, now), false);
}

// ---- clockTime ----
eq("a morning time is padded", clockTime(new Date(2026, 9, 24, 9, 5).getTime()), "09:05");
eq("an afternoon time", clockTime(new Date(2026, 9, 24, 14, 32).getTime()), "14:32");

console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
