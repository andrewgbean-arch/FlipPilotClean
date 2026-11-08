import "./setupEnv";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { aiPricePrompt, isUnrecognised, newListingsToShow, parseAiPriceReply, priceEvidence, type MarketEvidence } from "../market-backend/fetchMarketData";
import { buildFlipMeta } from "../market-backend/buildFlipMeta";
import { wantsUnknownMakeWithheld } from "../routes/scanSteps";

// Added 8 Nov 2026. A typed "Duotts C29" (an e-bike worth about £1,000) came back priced at £55: eBay UK lists three of them, all new, so a used-item lookup
// found nothing, and the AI, which does not know the brand, guessed £30 to £60. Two changes: when the AI says it does not know the make and nothing real was
// found, no price is given; and when eBay has new listings but no used ones, they are passed on for a block of their own (never used in the price).

const evidence = (over: Partial<MarketEvidence> = {}): MarketEvidence => ({
  usedPrice: null,
  retailPrice: 150,
  googlePriceMin: null,
  googlePriceMax: null,
  googleCount: 0,
  googleSearched: false,
  lowest: 30,
  highest: 60,
  soldCount: 0,
  demandScore: 0,
  sellThroughRating: null,
  confidence: 40,
  aiPriceMin: 30,
  aiPriceMax: 60,
  aiPriceConfidence: 50,
  ebay: null,
  ebayItems: [],
  googleItems: [],
  image: null,
  priceInputs: { ebayNew: null, ebay: null, ebayListings: 0, googleNew: null, aiNew: 150, aiUsedMin: 30, aiUsedMax: 60, marketFloor: null },
  ...over,
});

const ebayResult = (over: Record<string, unknown> = {}): any => ({ average: 300, lowest: 290, highest: 867, soldCount: 3, items: [{ title: "x" }], ...over });

describe("isUnrecognised: no price when the AI is only guessing and nothing real was found", () => {
  test("the AI says it does not know the make and nothing was found", () => {
    assert.equal(isUnrecognised({ aiRecognised: false, ebayListings: 0, googleCount: 0 }), true);
  });

  test("the AI saying it knows it, or saying nothing, never withholds a price", () => {
    assert.equal(isUnrecognised({ aiRecognised: true, ebayListings: 0, googleCount: 0 }), false);
    assert.equal(isUnrecognised({ aiRecognised: null, ebayListings: 0, googleCount: 0 }), false);
    assert.equal(isUnrecognised({ aiRecognised: undefined, ebayListings: 0, googleCount: 0 }), false);
  });

  test("anything real found is priced from, whatever the AI says", () => {
    assert.equal(isUnrecognised({ aiRecognised: false, ebayListings: 1, googleCount: 0 }), false);
    assert.equal(isUnrecognised({ aiRecognised: false, ebayListings: 24, googleCount: 0 }), false);
    assert.equal(isUnrecognised({ aiRecognised: false, ebayListings: 0, googleCount: 3 }), false);
  });
});

describe("priceEvidence with an item nobody can price", () => {
  const withhold = { withholdUnknown: true };

  test("gives no price, no range and none of the AI's guess", () => {
    const r = priceEvidence(evidence({ aiRecognised: false }), true, "good", "within-6-months", withhold);
    assert.equal(r.unrecognised, true);
    for (const field of ["average", "smartPrice", "lowest", "highest", "usedPrice", "retailPrice", "aiPriceMin", "aiPriceMax", "aiPriceConfidence"] as const) {
      assert.equal(r[field], null, field);
    }
  });

  test("still says why, and keeps what was found beside it", () => {
    const r = priceEvidence(
      evidence({ aiRecognised: false, ebayNew: { lowest: 290, highest: 867, soldCount: 3 }, ebayNewItems: [{ title: "Duotts" }] }),
      true,
      "good",
      "within-6-months",
      withhold
    );
    assert.equal(r.aiRecognised, false);
    assert.equal(r.ebayNew?.lowest, 290);
    assert.equal(r.ebayNewItems?.length, 1);
  });

  test("the flip score then says there is no reliable resale price, and does not fall over", () => {
    const r = priceEvidence(evidence({ aiRecognised: false }), true, "good", "within-6-months", withhold);
    const meta = buildFlipMeta(r);
    assert.ok(meta.flipScore <= 15, `flip score ${meta.flipScore}`);
    assert.match(String(meta.insights), /No reliable resale price/);
  });

  test("asked, but the AI knows the make (or says nothing): priced as before", () => {
    for (const aiRecognised of [true, null]) {
      const r = priceEvidence(evidence({ aiRecognised }), true, "good", "within-6-months", withhold);
      assert.equal(r.unrecognised, false);
      assert.ok(typeof r.average === "number" && r.average > 0, `average ${r.average}`);
      assert.ok(typeof r.smartPrice === "number" && r.smartPrice > 0, `smartPrice ${r.smartPrice}`);
      assert.equal(r.aiPriceMin, 30);
      assert.equal(r.lowest, 30);
    }
  });

  test("asked, the AI does not know the make, but listings were found: priced from them", () => {
    const r = priceEvidence(
      evidence({ aiRecognised: false, soldCount: 12, priceInputs: { ...evidence().priceInputs, ebay: 80, ebayListings: 12 } }),
      true,
      "good",
      "within-6-months",
      withhold
    );
    assert.equal(r.unrecognised, false);
    assert.ok(typeof r.average === "number" && r.average > 0);
  });

  test("not asked (every other caller, and a name the person has just changed): the AI's guess is shown, as it always was", () => {
    for (const options of [undefined, {}, { withholdUnknown: false }]) {
      const r = priceEvidence(evidence({ aiRecognised: false }), true, "good", "within-6-months", options);
      assert.equal(r.unrecognised, false);
      assert.ok(typeof r.average === "number" && r.average > 0, `average ${r.average}`);
      assert.equal(r.aiPriceMax, 60);
    }
  });
});

describe("newListingsToShow: eBay's new listings, only when no used one was found", () => {
  test("an item priced as used with no used listings gets the new ones", () => {
    const r = newListingsToShow(true, ebayResult({ soldCount: 0, items: [] }), ebayResult());
    assert.ok(r);
    assert.equal(r.items.length, 1);
    assert.deepEqual(r.summary, { lowest: 290, highest: 867, soldCount: 3 });
  });

  test("the listings come from ebayData when the result has it, as the used ones do", () => {
    const r = newListingsToShow(true, null, ebayResult({ ebayData: { items: [{ title: "a" }, { title: "b" }] } }));
    assert.equal(r?.items.length, 2);
  });

  test("never when there are used listings, or for an item priced as new", () => {
    assert.equal(newListingsToShow(true, ebayResult({ soldCount: 2 }), ebayResult()), null);
    assert.equal(newListingsToShow(false, ebayResult({ soldCount: 0, items: [] }), ebayResult()), null);
  });

  test("never without new listings, or without a range to show for them", () => {
    assert.equal(newListingsToShow(true, null, null), null);
    assert.equal(newListingsToShow(true, null, ebayResult({ items: [] })), null);
    assert.equal(newListingsToShow(true, null, ebayResult({ lowest: null, highest: null })), null);
  });
});

describe("which price requests ask for 'no price' on a make nobody knows", () => {
  test("the first lookup of a build that can explain it does", () => {
    assert.equal(wantsUnknownMakeWithheld(false), true);
  });

  test("a name the person has just changed does not: they get the AI's guess", () => {
    assert.equal(wantsUnknownMakeWithheld(true), false);
  });

  test("a build that sends nothing keeps the old answer (and nothing odd counts as asking)", () => {
    for (const v of [undefined, null, "false", 0, "", {}]) assert.equal(wantsUnknownMakeWithheld(v), false, JSON.stringify(v));
  });
});

describe("reading the AI's answer", () => {
  test("keeps the prices and whether it knows the make, through the ```json fences it often adds", () => {
    const r = parseAiPriceReply('```json\n{"newPrice": 150, "usedMin": 30, "usedMax": 60, "confidence": 50, "recognised": false}\n```');
    assert.deepEqual(r, { newPrice: 150, min: 30, max: 60, confidence: 50, recognised: false });
    assert.equal(parseAiPriceReply('{"newPrice": 299, "usedMin": 150, "usedMax": 220, "confidence": 85, "recognised": true}').recognised, true);
  });

  test("an answer that leaves 'recognised' out, or gives anything but true or false, says nothing either way", () => {
    assert.equal(parseAiPriceReply('{"newPrice": 100, "usedMin": 20, "usedMax": 40, "confidence": 70}').recognised, null);
    assert.equal(parseAiPriceReply('{"newPrice": 100, "recognised": "false"}').recognised, null);
    assert.equal(parseAiPriceReply('{"newPrice": 100, "recognised": 0}').recognised, null);
  });

  test("missing or odd prices are no price, not zero or NaN", () => {
    const r = parseAiPriceReply('{"newPrice": "lots"}');
    assert.deepEqual(r, { newPrice: null, min: null, max: null, confidence: null, recognised: null });
  });

  test("an answer that is not JSON is an error, for the caller to count as no answer", () => {
    assert.throws(() => parseAiPriceReply("I cannot help with that"));
  });
});

describe("the AI is asked whether it knows the item", () => {
  const p = aiPricePrompt("Duotts C29");
  test("asks for a recognised answer in the JSON", () => {
    assert.ok(p.includes('"recognised"'));
    assert.match(p, /true if you genuinely know this specific make and model/);
  });

  test("tells it to say so rather than invent a price from how the words sound", () => {
    assert.match(p, /do not invent a price from how the words sound/);
    assert.match(p, /many small online-only brands are\s+unfamiliar/);
  });
});
