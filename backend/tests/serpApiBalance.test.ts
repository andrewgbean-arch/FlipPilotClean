import "./setupEnv";
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  assessSearches,
  isOutOfSearchesError,
  noteSerpApiFailure,
  noteSerpApiSuccess,
  serpApiRefusal,
  clearSerpApiStateForTests,
} from "../utils/serpApiBalance";

// 2026-10-05: the free plan's 250 searches ran out and nobody was told; Google prices just stopped
// arriving. These cover the two warnings that now exist (the balance, and a refused search).

describe("assessSearches", () => {
  test("none left is out, whatever the allowance", () => {
    assert.equal(assessSearches({ left: 0, perMonth: 250 }), "out");
    assert.equal(assessSearches({ left: -4 }), "out");
  });
  test("under a fifth of the allowance left is low", () => {
    assert.equal(assessSearches({ left: 49, perMonth: 250 }), "low");
    assert.equal(assessSearches({ left: 50, perMonth: 250 }), "ok");
  });
  test("works out the allowance from left + used when the plan size is not given", () => {
    assert.equal(assessSearches({ left: 10, used: 240 }), "low");
    assert.equal(assessSearches({ left: 200, used: 50 }), "ok");
  });
  test("unreadable balance is unknown, never a false alarm", () => {
    assert.equal(assessSearches({ left: undefined }), "unknown");
    assert.equal(assessSearches({ left: "n/a" }), "unknown");
    assert.equal(assessSearches({ left: null, perMonth: 250 }), "unknown");
  });
  test("a balance with no allowance information is fine", () => {
    assert.equal(assessSearches({ left: 30 }), "ok");
  });
});

describe("isOutOfSearchesError", () => {
  test("recognises SerpAPI's own refusal", () => {
    assert.equal(isOutOfSearchesError({ response: { status: 429, data: { error: "Your account has run out of searches." } } }), true);
  });
  test("an ordinary rate limit or timeout is not mistaken for it", () => {
    assert.equal(isOutOfSearchesError({ response: { status: 429, data: { error: "Too many requests per hour" } } }), false);
    assert.equal(isOutOfSearchesError({ response: { status: 500, data: { error: "run out of searches" } } }), false);
    assert.equal(isOutOfSearchesError(new Error("timeout of 7000ms exceeded")), false);
    assert.equal(isOutOfSearchesError(undefined), false);
  });
});

describe("refusal tracking", () => {
  beforeEach(() => clearSerpApiStateForTests());

  test("an out-of-searches refusal is recorded, and the next success clears it", () => {
    assert.equal(serpApiRefusal().refusedAt, null);
    noteSerpApiFailure({ response: { status: 429, data: { error: "Your account has run out of searches." } } }, 1_000_000);
    assert.equal(serpApiRefusal().refusedAt, new Date(1_000_000).toISOString());
    noteSerpApiSuccess();
    assert.equal(serpApiRefusal().refusedAt, null);
  });

  test("other failures are not recorded as the account being out", () => {
    noteSerpApiFailure(new Error("socket hang up"));
    assert.equal(serpApiRefusal().refusedAt, null);
  });
});
