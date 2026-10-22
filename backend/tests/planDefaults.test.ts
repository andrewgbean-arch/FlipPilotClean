import "./setupEnv";
// The numbers the owner chose on 22 Oct 2026, pinned with no setting overriding them. The other tests shrink them to stay quick.
delete process.env.FREE_SCANS_PER_MONTH;
delete process.env.PRO_DAILY_SCANS;
delete process.env.ANONYMOUS_SCANS;
delete process.env.CREDIT_PACKS_ON_SALE;
delete process.env.GOOGLE_SHOPPING;

import { test } from "node:test";
import assert from "node:assert/strict";
import { ANONYMOUS_FREE_LIMIT, ANONYMOUS_FREE_PER_ADDRESS, MONTHLY_FREE_LIMIT, anonymousScansAllowed } from "../middleware/freeScanLimit";
import { PRO_DAILY_SCANS } from "../utils/proAllowance";
import { creditPackList } from "../utils/creditPacks";
import { GOOGLE_PRICEY_FROM, GOOGLE_THIN_BELOW, googleShoppingMode, googleWorthIt } from "../market-backend/fetchMarketData";

test("free to use: 100 scans a month with an account, and nothing without one", () => {
  assert.equal(MONTHLY_FREE_LIMIT, 100);
  assert.equal(anonymousScansAllowed(), false, "signing up is how you scan");
  assert.equal(ANONYMOUS_FREE_LIMIT, 10, "what the testing lever gives a phone, a month");
  assert.equal(ANONYMOUS_FREE_PER_ADDRESS, 30, "what the testing lever lets a whole network use, a week");
});

test("Pro is unlimited with a fair-use ceiling of 150 scans a day", () => {
  assert.equal(PRO_DAILY_SCANS, 150);
});

test("the credit packs are retired: none are offered unless the server says so", () => {
  assert.deepEqual(creditPackList(), []);
});

test("Google is for Pro subscribers on pricier or thin items: that is the default", () => {
  assert.equal(googleShoppingMode(), "pro");
  assert.equal(GOOGLE_PRICEY_FROM, 150);
  assert.equal(GOOGLE_THIN_BELOW, 5);
});

test("which items are worth a Google search: pricey ones, and ones eBay found little on", () => {
  const cheapWell = { ebayAverage: 20, ebayListings: 30, aiNew: 40 };
  assert.equal(googleWorthIt(cheapWell), false, "a cheap item with plenty of eBay listings does not need it");
  assert.equal(googleWorthIt({ ...cheapWell, ebayListings: 4 }), true, "thin: eBay found under 5 listings");
  assert.equal(googleWorthIt({ ...cheapWell, ebayListings: 5 }), false, "5 listings is enough");
  assert.equal(googleWorthIt({ ...cheapWell, aiNew: 499.99 }), true, "pricey by the AI's new price (a PS5 Pro)");
  assert.equal(googleWorthIt({ ...cheapWell, aiNew: 250, ebayAverage: 318 }), true, "pricey by eBay's figure when the AI is out of date (a Switch 2)");
  assert.equal(googleWorthIt({ ...cheapWell, ebayNewAverage: 200 }), true, "pricey by eBay's new-listing figure");
  assert.equal(googleWorthIt({ ebayAverage: 150, ebayListings: 30, aiNew: 150 }), false, "exactly 150 is not over it");
  assert.equal(googleWorthIt({ ebayAverage: null, ebayListings: 0, aiNew: null }), true, "no evidence at all counts as thin");
});
