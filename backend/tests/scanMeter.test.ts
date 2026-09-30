import "./setupEnv";
// The free-scan/credit meter is skipped entirely unless this is explicitly turned on (see
// freeScanCapEnabled in middleware/freeScanLimit.ts) — off by default in a test/dev environment.
process.env.FREE_SCAN_CAP = "on";
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
import { takeFreeScan } from "../middleware/freeScanLimit";
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

    // Use up this device's free scans so the request actually reaches the credit-store branch
    // rather than being satisfied by a free scan first.
    for (let i = 0; i < 5; i++) takeFreeScan(deviceId);

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

  test("a device with free scans left is let straight through, unaffected", async () => {
    const res = await fetch(`${base}/lookup`, {
      headers: { "x-device-id": "scanmeter-ordinary-device" },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.ok, true);
  });
});
