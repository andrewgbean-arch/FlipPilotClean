import "./setupEnv";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { cleanTypedTitle, TYPED_MAX, TYPED_MAX_WORDS, TYPED_MIN } from "../market-backend/typedTitle";

// Added 29 Oct 2026 with the "type the make and model number" box on the Scan screen. What someone types goes to eBay,
// Google and the price AI as the thing to price, so it is cleaned first and must look like a make and model.

const title = (raw: unknown) => {
  const r = cleanTypedTitle(raw);
  assert.equal(r.ok, true, `expected ${JSON.stringify(raw)} to be accepted`);
  return (r as { ok: true; title: string }).title;
};
const refused = (raw: unknown) => {
  const r = cleanTypedTitle(raw);
  assert.equal(r.ok, false, `expected ${JSON.stringify(raw)} to be turned away`);
  return (r as { ok: false; message: string }).message;
};

describe("a make and model that is kept", () => {
  test("is kept as it was typed, with the spaces tidied", () => {
    assert.equal(title("Sony WH-1000XM4"), "Sony WH-1000XM4");
    assert.equal(title("   Sony    WH-1000XM4  "), "Sony WH-1000XM4");
    assert.equal(title("Sony\nWH-1000XM4\t"), "Sony WH-1000XM4");
  });

  test("keeps the punctuation a product name really uses", () => {
    assert.equal(title("Levi's 501 Jeans"), "Levi's 501 Jeans");
    assert.equal(title('Samsung 32" TV UE32T4300'), 'Samsung 32" TV UE32T4300');
    assert.equal(title("Dyson V8 Absolute (2019)"), "Dyson V8 Absolute (2019)");
    assert.equal(title("Black & Decker KR554RE 550W"), "Black & Decker KR554RE 550W");
    assert.equal(title("Cadbury Dairy Milk 6 x 45g"), "Cadbury Dairy Milk 6 x 45g");
  });

  test("keeps letters of any language", () => {
    assert.equal(title("Bürstner Lyseo TD 736"), "Bürstner Lyseo TD 736");
  });

  test("the shortest and longest allowed", () => {
    assert.equal(title("Aga"), "Aga");
    assert.ok(TYPED_MIN <= 3);
    const longest = ("x".repeat(9) + " ").repeat(9) + "x".repeat(10);
    assert.equal(longest.length, TYPED_MAX);
    assert.equal(title(longest), longest);
  });
});

describe("symbols that mean something to a search or a program are dropped", () => {
  test("they become spaces, and the words around them stay", () => {
    assert.equal(title("Sony; WH-1000XM4"), "Sony WH-1000XM4");
    assert.equal(title("Sony {WH-1000XM4} [black]"), "Sony WH-1000XM4 black");
    assert.equal(title("Sony `WH-1000XM4` $5 | ^ ~ = * _ \\ : ?"), "Sony WH-1000XM4 5");
  });

  test("control characters never get through", () => {
    assert.equal(title("Sony\u0000 WH\u0007-1000XM4\u001b"), "Sony WH -1000XM4");
  });
});

describe("what is turned away, with words the person can act on", () => {
  test("nothing, or not text", () => {
    for (const bad of [undefined, null, 42, {}, [], true, "", "   ", "\n\t"]) {
      assert.match(refused(bad), /Type the make and model number/);
    }
  });

  test("too short to be a make and model", () => {
    for (const bad of ["a", "ab", "a b", "-- --", "1 2"]) assert.match(refused(bad), /too short/);
  });

  test("numbers on their own (a model number needs its make)", () => {
    for (const bad of ["12345678", "1000 4", "5449000000996"]) assert.match(refused(bad), /Numbers on their own/);
  });

  test("a web address or an e-mail address", () => {
    for (const bad of ["https://www.ebay.co.uk/itm/123", "www.ebay.co.uk", "Sony WH-1000XM4 ebay.com", "me@example.com", "visit shop.co.uk/phones"]) {
      assert.match(refused(bad), /web or e-mail address/, bad);
    }
  });

  test("too long: more characters, more words, or a huge body", () => {
    assert.match(refused("x".repeat(TYPED_MAX + 1)), /a bit long/);
    assert.match(refused(Array.from({ length: TYPED_MAX_WORDS + 1 }, () => "ab").join(" ")), /a bit long/);
    assert.match(refused("Sony ".repeat(200)), /a bit long/);
  });

  test("the words are plain English, with no jargon, and always give an example", () => {
    for (const bad of [undefined, "ab", "123456789", "www.x.com", "x".repeat(200)]) {
      const message = refused(bad);
      assert.match(message, /Sony WH-1000XM4/);
      assert.doesNotMatch(message, /\b(AI|token|server|API|error|invalid)\b/i);
    }
  });
});
