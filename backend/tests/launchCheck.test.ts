import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { launchIssues } from "../utils/launchCheck";

// Decided 23 Oct 2026: the free-listing launch offer has no end date until credit packs are on sale, because once it
// ends a car advert costs credits and with no packs to buy nobody could pay. So the start-up checklist must not
// shout "must fix" about it; it is a reminder to set the date AFTER the packs exist.

const promo = (env: Record<string, string>) =>
  launchIssues({ NODE_ENV: "production", ...env }).find((i) => i.setting === "MARKETPLACE_PROMO_ENDS_AT");

describe("the launch check and the launch offer's end date", () => {
  test("a missing end date is a reminder, not a fault, and says to wait for the credit packs", () => {
    const issue = promo({});
    assert.equal(issue?.level, "should", "no end date is intended until credit packs are on sale");
    assert.match(issue!.why, /credit packs/);
    assert.match(issue!.why, /CREDIT_PACKS_ON_SALE/);
  });

  test("a date that cannot be read counts as missing", () => {
    assert.equal(promo({ MARKETPLACE_PROMO_ENDS_AT: "next spring" })?.level, "should");
  });

  test("a real end date is not mentioned at all", () => {
    assert.equal(promo({ MARKETPLACE_PROMO_ENDS_AT: "2027-01-01" }), undefined);
  });

  test("it is not among the must-fix items, so a healthy launch can read 'every must-have setting is in place'", () => {
    const musts = launchIssues({ NODE_ENV: "production" }).filter((i) => i.level === "must").map((i) => i.setting);
    assert.ok(!musts.includes("MARKETPLACE_PROMO_ENDS_AT"), `MARKETPLACE_PROMO_ENDS_AT is still listed as must-fix: ${musts.join(", ")}`);
  });
});
