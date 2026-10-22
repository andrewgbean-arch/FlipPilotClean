import "./setupEnv";
// The free-scan/credit meter is skipped entirely unless this is explicitly turned on (see
// freeScanCapEnabled in middleware/freeScanLimit.ts) — off by default in a test/dev environment.
process.env.FREE_SCAN_CAP = "on";
process.env.FREE_SCANS_PER_MONTH = "5";
delete process.env.ANONYMOUS_SCANS;
// No real RevenueCat call: planStatus() returns synchronously with "not on a plan" when this is
// unset, which is what puts a signed-in test account on the credit-store path this test needs.
delete process.env.REVENUECAT_SECRET_KEY;

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import type { AddressInfo } from "net";
import fs from "fs";
import { dataPath } from "../config/dataDir";
import { MONTHLY_FREE_LIMIT, accountFreeKey, takeFreeScan } from "../middleware/freeScanLimit";
import { scanMeter } from "../middleware/scanMeter";

// Found live 2026-09-30: scanMeter had no try/catch around any of this, and creditStore.ts's
// load() deliberately THROWS on a corrupted credits.json rather than silently resetting to {}
// (so a damaged file is never mistaken for an empty one — see the comment there). Express 4 does
// not catch a throw from inside async middleware, so with nothing here to catch it, that throw
// was an unhandled rejection — and Node's default policy for those is to crash the whole process.
// One damaged file could take down scanning for every user, not just the one whose file it was.

let base = "";
let server: http.Server;

before(async () => {
  const app = express();
  app.use(express.json());
  // A stub for the real auth middleware: this test says which signed-in account (if any) made
  // the request via a header, and sets req.account exactly like the real one would.
  app.use((req: any, _res, next) => {
    const acc = req.headers["x-test-account"];
    if (typeof acc === "string") req.account = { id: acc };
    next();
  });
  app.get("/lookup", scanMeter, (_req, res) => res.json({ ok: true }));
  await new Promise<void>((ok) => {
    server = app.listen(0, "127.0.0.1", () => ok());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server?.closeAllConnections();
  server?.close();
});

describe("scanMeter", () => {
  test("a corrupted credits.json returns a clean 503, not a crashed/hung request", async () => {
    const deviceId = "scanmeter-crash-test-device";
    const accountId = "scanmeter-crash-test-account";

    // Use up this ACCOUNT's free scans (a signed-in account's free scans are counted per account,
    // not per phone) so the request actually reaches the credit-store branch rather than being
    // satisfied by a free scan first.
    for (let i = 0; i < MONTHLY_FREE_LIMIT; i++) takeFreeScan(accountFreeKey(accountId), MONTHLY_FREE_LIMIT);

    // The exact scenario creditStore.ts's load() refuses to paper over.
    fs.writeFileSync(dataPath("credits.json"), "{ not valid json");

    const res = await fetch(`${base}/lookup`, {
      headers: { "x-device-id": deviceId, "x-test-account": accountId },
    });
    assert.equal(res.status, 503);
    const body = (await res.json()) as any;
    assert.equal(body.error, "busy");

    // Clean up so this doesn't affect any other test file's credits.json in the same run.
    fs.writeFileSync(dataPath("credits.json"), "{}");
  });

  test("an account with free scans left is let straight through, unaffected", async () => {
    const res = await fetch(`${base}/lookup`, {
      headers: { "x-device-id": "scanmeter-ordinary-device", "x-test-account": "scanmeter-ordinary-account" },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.ok, true);
  });

  test("a phone that is not signed in is asked to sign up, not let through", async () => {
    const res = await fetch(`${base}/lookup`, { headers: { "x-device-id": "scanmeter-not-signed-in" } });
    const body = (await res.json()) as any;
    assert.equal(body.error, "free-scan-limit");
    assert.equal(body.signInRequired, true);
  });

  test("a request with no device id at all is refused, signed in or not", async () => {
    const res = await fetch(`${base}/lookup`, { headers: { "x-test-account": "scanmeter-no-device" } });
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as any).error, "missing-device");
  });
});
