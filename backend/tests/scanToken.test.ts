import "./setupEnv";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { issueScanToken, useScanToken, checkScanToken, SCAN_TOKEN_MAX_TITLES, SCAN_TOKEN_MAX_USES } from "../utils/scanToken";

// One charged scan used to be a licence for SCAN_TOKEN_MAX_USES price lookups of ANY items: eight
// different titles, each a real Google search and AI call, for the price of one credit. A token now
// covers one item: the scanned name plus a couple of corrections.

describe("scan token covers one item", () => {
  test("changing condition or age re-checks the SAME title as often as the use limit allows", () => {
    const token = issueScanToken("phone-1");
    for (let i = 0; i < SCAN_TOKEN_MAX_USES; i++) {
      assert.equal(useScanToken(token, "phone-1", Date.now(), "Sony WH-1000XM5 Headphones").ok, true, `use ${i + 1}`);
    }
    const next = useScanToken(token, "phone-1", Date.now(), "Sony WH-1000XM5 Headphones");
    assert.deepEqual(next, { ok: false, reason: "used-up" });
  });

  test("the same title in a different case or spacing is still the same item", () => {
    const token = issueScanToken("phone-2");
    assert.equal(useScanToken(token, "phone-2", Date.now(), "Sony  WH-1000XM5").ok, true);
    assert.equal(useScanToken(token, "phone-2", Date.now(), " sony wh-1000xm5 ").ok, true);
    assert.equal(useScanToken(token, "phone-2", Date.now(), "SONY WH-1000XM5").ok, true);
  });

  test("the scanned name plus two corrections are allowed, a third different item is refused", () => {
    const token = issueScanToken("phone-3");
    const names = ["Dyson V8", "Dyson V8 Absolute", "Dyson V8 Absolute Cordless"];
    assert.equal(names.length, SCAN_TOKEN_MAX_TITLES);
    for (const n of names) assert.equal(useScanToken(token, "phone-3", Date.now(), n).ok, true, n);
    assert.deepEqual(useScanToken(token, "phone-3", Date.now(), "PlayStation 5"), { ok: false, reason: "other-item" });
  });

  test("a refused other-item does not spend a use, and the known titles still work", () => {
    const token = issueScanToken("phone-4");
    for (const n of ["a one", "b two", "c three"]) useScanToken(token, "phone-4", Date.now(), n);
    // Four refused attempts must not eat the remaining uses (3 used so far, 5 left).
    for (let i = 0; i < 4; i++) assert.equal(useScanToken(token, "phone-4", Date.now(), `other ${i}`).ok, false);
    const again = useScanToken(token, "phone-4", Date.now(), "a one");
    assert.equal(again.ok, true);
    assert.equal(again.ok && again.usesLeft, SCAN_TOKEN_MAX_USES - 4);
  });

  test("a request with no title is not counted as a new item (older app builds)", () => {
    const token = issueScanToken("phone-5");
    for (let i = 0; i < 6; i++) assert.equal(useScanToken(token, "phone-5", Date.now()).ok, true);
  });

  test("another phone still cannot use the token", () => {
    const token = issueScanToken("phone-6");
    assert.deepEqual(useScanToken(token, "phone-7", Date.now(), "Anything"), { ok: false, reason: "wrong-phone" });
  });
});

// Found by review 2026-10-09: normalTitle had lost its backslash (/s+/ instead of /\s+/), so every run of the
// letter "s" became a space ("Dyson V8" -> "dy on v8") and real whitespace was never collapsed. The earlier
// tests only passed because two names fit under the cap of 3.
describe("title matching is about words, not letters", () => {
  test("extra spaces and capitals are the same name", () => {
    const token = issueScanToken("phone-t1");
    for (const t of ["Sony WH-1000XM5", "Sony  WH-1000XM5", " sony wh-1000xm5 ", "SONY\tWH-1000XM5"]) {
      assert.equal(useScanToken(token, "phone-t1", Date.now(), t).ok, true, JSON.stringify(t));
    }
    // Still room for two more genuinely different names.
    assert.equal(useScanToken(token, "phone-t1", Date.now(), "Sony WH-1000XM4").ok, true);
    assert.equal(useScanToken(token, "phone-t1", Date.now(), "Sony WF-1000XM5").ok, true);
    assert.deepEqual(useScanToken(token, "phone-t1", Date.now(), "Bose QC45"), { ok: false, reason: "other-item" });
  });

  test("names that differ only in where the letter s is are different names", () => {
    const token = issueScanToken("phone-t2");
    const names = ["Dyson V8", "Dy on V8", "Dyson V10"];
    for (const n of names) assert.equal(useScanToken(token, "phone-t2", Date.now(), n).ok, true, n);
    assert.deepEqual(useScanToken(token, "phone-t2", Date.now(), "Dyson V11"), { ok: false, reason: "other-item" });
  });
});

describe("looking at a token counts nothing; using it does", () => {
  test("checkScanToken can be called as often as you like", () => {
    const token = issueScanToken("phone-c1");
    for (let i = 0; i < 25; i++) assert.deepEqual(checkScanToken(token, "phone-c1", Date.now(), "A thing"), { ok: true, usesLeft: SCAN_TOKEN_MAX_USES });
    assert.deepEqual(useScanToken(token, "phone-c1", Date.now(), "A thing"), { ok: true, usesLeft: SCAN_TOKEN_MAX_USES - 1 });
  });

  test("checkScanToken refuses the same things useScanToken does, and does not remember a name", () => {
    const token = issueScanToken("phone-c2");
    assert.deepEqual(checkScanToken(token, "other-phone", Date.now(), "x"), { ok: false, reason: "wrong-phone" });
    assert.deepEqual(checkScanToken("junk", "phone-c2"), { ok: false, reason: "invalid" });
    assert.deepEqual(checkScanToken(undefined, "phone-c2"), { ok: false, reason: "missing" });
    // Looking at three names does not use up the three-name allowance.
    for (const n of ["one", "two", "three", "four"]) checkScanToken(token, "phone-c2", Date.now(), n);
    for (const n of ["a", "b", "c"]) assert.equal(useScanToken(token, "phone-c2", Date.now(), n).ok, true);
    assert.deepEqual(checkScanToken(token, "phone-c2", Date.now(), "d"), { ok: false, reason: "other-item" });
  });
});
