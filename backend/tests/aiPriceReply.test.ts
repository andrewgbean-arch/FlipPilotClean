import "./setupEnv";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseAiPriceReply } from "../market-backend/fetchMarketData";

// Added 10 Nov 2026. Asked the price question ten times, gpt-4o-mini wrote "newPrice": 1,200 (a thousands comma, which is not valid JSON) in 3 answers for a Brompton M6L and 8 for a
// Brompton P Line, 20 of 80 across eight items priced around £1,000 to £1,500, and every unreadable answer was this. The whole AI opinion was thrown away, so the item was priced
// without it, and the same item got a different price from one scan to the next. The replies below are the real ones.

describe("reading the AI's price answer", () => {
  test("a thousands comma in the new price, as written for a Brompton M6L", () => {
    const r = parseAiPriceReply('{\n  "newPrice": 1,200,\n  "usedMin": 600,\n  "usedMax": 900,\n  "confidence": 80,\n  "recognised": true\n}');
    assert.deepEqual(r, { newPrice: 1200, min: 600, max: 900, confidence: 80, recognised: true });
  });

  test("a thousands comma in the used range too", () => {
    assert.deepEqual(
      parseAiPriceReply('{ "newPrice": 1,200, "usedMin": 800, "usedMax": 1,000, "confidence": 80, "recognised": true }'),
      { newPrice: 1200, min: 800, max: 1000, confidence: 80, recognised: true }
    );
    assert.deepEqual(
      parseAiPriceReply('{ "newPrice": 1,500, "usedMin": 900, "usedMax": 1,200, "confidence": 80, "recognised": true }'),
      { newPrice: 1500, min: 900, max: 1200, confidence: 80, recognised: true }
    );
    assert.deepEqual(
      parseAiPriceReply('{ "newPrice": 1,800, "usedMin": 1,200, "usedMax": 1,500, "confidence": 80, "recognised": true }'),
      { newPrice: 1800, min: 1200, max: 1500, confidence: 80, recognised: true }
    );
  });

  test("on one line, compact, and inside the ```json fences it often adds", () => {
    assert.equal(parseAiPriceReply('{"newPrice":1,200,"usedMin":600,"usedMax":900,"confidence":80}').newPrice, 1200);
    assert.equal(parseAiPriceReply('{"newPrice":1,200}').newPrice, 1200);
    assert.deepEqual(
      parseAiPriceReply('```json\n{\n  "newPrice": 1,700,\n  "usedMin": 1,000,\n  "usedMax": 1,300,\n  "confidence": 75,\n  "recognised": false\n}\n```'),
      { newPrice: 1700, min: 1000, max: 1300, confidence: 75, recognised: false }
    );
  });

  test("pence, and amounts in the tens of thousands", () => {
    assert.equal(parseAiPriceReply('{"newPrice": 1,299.99, "usedMin": 700, "usedMax": 900}').newPrice, 1299.99);
    assert.equal(parseAiPriceReply('{"newPrice": 12,500, "usedMin": 9,000, "usedMax": 11,000}').newPrice, 12500);
    assert.equal(parseAiPriceReply('{"newPrice": 1,200,000, "usedMin": 1}').newPrice, 1200000);
  });

  test("a currency sign, with or without a comma, and prices written as text", () => {
    assert.equal(parseAiPriceReply('{"newPrice": £1200, "usedMin": £600, "usedMax": £900}').newPrice, 1200);
    assert.equal(parseAiPriceReply('{"newPrice": £1,200, "usedMin": £600, "usedMax": £900}').newPrice, 1200);
    assert.equal(parseAiPriceReply('{"newPrice": "£1,200", "usedMin": "600", "usedMax": "900.50"}').newPrice, 1200);
    assert.equal(parseAiPriceReply('{"newPrice": "£1,200", "usedMin": "600", "usedMax": "900.50"}').max, 900.5);
    assert.equal(parseAiPriceReply('{"newPrice": "1,200 GBP"}').newPrice, null, "text that is not just a price is no price");
  });

  test("an answer that was already valid is read exactly as before", () => {
    assert.deepEqual(
      parseAiPriceReply('{"newPrice": 120, "usedMin": 60, "usedMax": 90, "confidence": 70, "recognised": true}'),
      { newPrice: 120, min: 60, max: 90, confidence: 70, recognised: true }
    );
    assert.deepEqual(
      parseAiPriceReply('{"newPrice":1200,"usedMin":600,"usedMax":900,"confidence":80,"recognised":true}'),
      { newPrice: 1200, min: 600, max: 900, confidence: 80, recognised: true }
    );
    // numbers near the commas that separate the fields are not run together
    assert.deepEqual(
      parseAiPriceReply('{"newPrice": 100,\n"usedMin": 200,\n"usedMax": 300,\n"confidence": 400}'),
      { newPrice: 100, min: 200, max: 300, confidence: 400, recognised: null }
    );
    assert.deepEqual(parseAiPriceReply('{"newPrice":100,"usedMin":200,"usedMax":300}'), { newPrice: 100, min: 200, max: 300, confidence: null, recognised: null });
  });

  test("only a real thousands comma is mended: a decimal comma or a longer run of digits is an error, never a guess", () => {
    assert.throws(() => parseAiPriceReply('{"newPrice": 12,50, "usedMin": 5}'), "12,50 is twelve pounds fifty, not 1250");
    assert.throws(() => parseAiPriceReply('{"newPrice": 1,2000}'), "four digits after the comma is not a thousands group");
    assert.throws(() => parseAiPriceReply('{"newPrice": 1,20}'), "two digits after the comma is not a thousands group");
    assert.throws(() => parseAiPriceReply('{"newPrice": 1,200 pounds}'), "words after the number are not guessed at");
  });

  test("a number inside a quoted string is left alone", () => {
    assert.equal(parseAiPriceReply('{"newPrice": 150, "note": "about 1,200 on eBay", "usedMin": 50}').newPrice, 150);
    assert.equal(parseAiPriceReply('{"newPrice": 150, "note": "about 1,200 on eBay", "usedMin": 50}').min, 50);
  });

  test("words around the JSON are skipped", () => {
    assert.equal(parseAiPriceReply('Here is the estimate: {"newPrice": 1,200, "usedMin": 600, "usedMax": 900} Hope that helps!').newPrice, 1200);
    assert.equal(parseAiPriceReply('Sure!\n```json\n{"newPrice": 80, "usedMin": 20, "usedMax": 40}\n```\nLet me know.').max, 40);
  });

  test("a null or missing price is no price, not zero", () => {
    assert.deepEqual(parseAiPriceReply('{"newPrice": 100, "usedMin": null, "usedMax": 40}'), { newPrice: 100, min: null, max: 40, confidence: null, recognised: null });
    assert.deepEqual(parseAiPriceReply('{"newPrice": null}'), { newPrice: null, min: null, max: null, confidence: null, recognised: null });
    assert.equal(parseAiPriceReply('{"newPrice": 0, "usedMin": 5}').newPrice, 0, "a genuine 0 (an old model the AI says is no longer sold new) is kept as 0");
  });

  test("an answer that is not JSON at all is still an error, for the caller to count as no answer", () => {
    assert.throws(() => parseAiPriceReply("I cannot help with that"));
    assert.throws(() => parseAiPriceReply("{ not json"));
    assert.throws(() => parseAiPriceReply("null"));
    assert.throws(() => parseAiPriceReply("42"));
    assert.throws(() => parseAiPriceReply("1,2,3"));
  });
});
