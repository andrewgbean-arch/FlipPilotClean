import "./setupEnv";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { IDENTIFY_PROMPT, NOT_RECOGNISED, identifiedTitle } from "../routes/searchImage";

// Found 2026-10-18: shown a black, white, blurred or noisy photo, the AI invented "Portable Bluetooth Speaker"
// (the example in its own instructions) at 70-80% confidence, and the app priced that non-existent item. The AI is
// now told it may say it cannot tell (title null), and a photo that comes back with no real title is turned away.

describe("a photo the AI could not make out", () => {
  test("no title at all is turned away", () => {
    assert.equal(identifiedTitle(null), null);
    assert.equal(identifiedTitle(undefined), null);
    assert.equal(identifiedTitle({}), null);
    assert.equal(identifiedTitle({ title: null, confidence: 0 }), null);
    assert.equal(identifiedTitle({ title: "" }), null);
    assert.equal(identifiedTitle({ title: "   " }), null);
  });

  test("a title that is only a way of saying 'I don't know' is turned away", () => {
    for (const t of ["Unknown", "unknown item", "Unknown Item", "Unidentified object", "unrecognised product", "N/A", "none", "null", "undefined", "Unknown item."]) {
      assert.equal(identifiedTitle({ title: t }), null, t);
    }
  });

  test("a real title is kept as written, trimmed", () => {
    assert.equal(identifiedTitle({ title: "NIVEA Creme 150ml" }), "NIVEA Creme 150ml");
    assert.equal(identifiedTitle({ title: "  Portable Bluetooth Speaker " }), "Portable Bluetooth Speaker");
    assert.equal(identifiedTitle({ title: "Electric Mountain Bike" }), "Electric Mountain Bike");
  });

  test("a real title that merely starts with the word is NOT turned away", () => {
    assert.equal(identifiedTitle({ title: "Unknown Pleasures Vinyl LP" }), "Unknown Pleasures Vinyl LP");
    assert.equal(identifiedTitle({ title: "None of the Above Board Game" }), "None of the Above Board Game");
  });

  test("a title that is not text is turned away", () => {
    assert.equal(identifiedTitle({ title: 42 }), null);
    assert.equal(identifiedTitle({ title: ["Speaker"] }), null);
  });

  test("the reply is an error (so the free scan is handed back) with words the person can act on", () => {
    assert.equal(typeof NOT_RECOGNISED.error, "string");
    assert.ok(NOT_RECOGNISED.error.length > 0);
    assert.match(NOT_RECOGNISED.message, /better light/);
    assert.match(NOT_RECOGNISED.message, /one item/);
    assert.doesNotMatch(NOT_RECOGNISED.message, /\bAI\b/, "no jargon in the message");
  });

  test("the instructions let the AI say it cannot tell, and tie the example titles to items that are really there", () => {
    assert.match(IDENTIFY_PROMPT, /"title": null/);
    assert.match(IDENTIFY_PROMPT, /do not guess and do not invent an item/);
    assert.match(IDENTIFY_PROMPT, /only use a title like that when the item really is in the photo/);
  });
});
