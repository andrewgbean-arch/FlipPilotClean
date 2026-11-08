import "./setupEnv";
// The free-scan meter only runs when this is switched on (see freeScanCapEnabled in middleware/freeScanLimit.ts).
process.env.FREE_SCAN_CAP = "on";
delete process.env.ANONYMOUS_SCANS;
delete process.env.REVENUECAT_SECRET_KEY;

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import type { AddressInfo } from "net";
import scanSteps from "../routes/scanSteps";
import { MONTHLY_FREE_LIMIT, accountFreeKey, freeScanStatus, takeFreeScan } from "../middleware/freeScanLimit";
import { checkScanToken } from "../utils/scanToken";
import { costReport, resetCostLogForTests } from "../utils/costLog";

// Added 29 Oct 2026: POST /identify-text, the first step of a scan when the person types the make and model number
// instead of scanning. It is the REAL route here, behind the real scan meter: it costs one free scan, a typed name
// that is turned away costs nothing, and the token it hands back is the one the price step needs.

let base = "";
let server: http.Server;

before(async () => {
  const app = express();
  app.use(express.json());
  // Stands in for the sign-in middleware, as scanMeter.test.ts does: the header says which account is signed in.
  app.use((req: any, _res, next) => {
    const acc = req.headers["x-test-account"];
    if (typeof acc === "string") req.account = { id: acc };
    next();
  });
  app.use(scanSteps);
  await new Promise<void>((ok) => {
    server = app.listen(0, "127.0.0.1", () => ok());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server?.closeAllConnections();
  server?.close();
});

const identify = async (body: Record<string, unknown>, account?: string) => {
  const res = await fetch(`${base}/identify-text`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(account ? { "x-test-account": account } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
};
const used = (account: string) => freeScanStatus(accountFreeKey(account), MONTHLY_FREE_LIMIT).used;

describe("POST /identify-text", () => {
  test("a good make and model gets the cleaned title, a scan token for that phone and title, and costs one free scan", async () => {
    const r = await identify({ text: "  Sony   WH-1000XM4 ", deviceId: "typed-phone-1" }, "typed-acct-1");
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.title, "Sony WH-1000XM4");
    assert.equal(r.body.source, "typed");
    assert.equal(r.body.packCount, null);
    assert.equal(typeof r.body.scanToken, "string");
    // The token is the proof the price step asks for: valid for this phone and this title, not for another phone.
    assert.equal(checkScanToken(r.body.scanToken, "typed-phone-1", Date.now(), "Sony WH-1000XM4").ok, true);
    assert.equal(checkScanToken(r.body.scanToken, "someone-elses-phone", Date.now(), "Sony WH-1000XM4").ok, false);
    assert.equal(used("typed-acct-1"), 1);
  });

  test("a pack size in the typed name is picked out, as it is for a barcode", async () => {
    const r = await identify({ text: "Cadbury Dairy Milk 6 pack", deviceId: "typed-phone-2" }, "typed-acct-2");
    assert.equal(r.body.ok, true);
    assert.equal(r.body.packCount, 6);
  });

  test("a typed name that is turned away costs nothing: the scan is handed straight back", async () => {
    for (const text of ["", "ab", "12345678", "https://www.ebay.co.uk/itm/1", "x".repeat(300)]) {
      const r = await identify({ text, deviceId: "typed-phone-3" }, "typed-acct-3");
      assert.equal(r.body.error, "bad-text", JSON.stringify(text));
      assert.equal(typeof r.body.message, "string");
      assert.equal(r.body.scanToken, undefined, "no token for a name that was turned away");
    }
    const noText = await identify({ deviceId: "typed-phone-3" }, "typed-acct-3");
    assert.equal(noText.body.error, "bad-text");
    // The meter pays a scan back after the reply is sent; give that a moment, then it must be as if nothing happened.
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(used("typed-acct-3"), 0);
  });

  test("it is a scan like any other: a phone that is not signed in is asked to sign up", async () => {
    const r = await identify({ text: "Sony WH-1000XM4", deviceId: "typed-phone-4" });
    assert.equal(r.body.error, "free-scan-limit");
    assert.equal(r.body.signInRequired, true);
    assert.equal(r.body.scanToken, undefined);
  });

  test("it is a scan like any other: once the free scans are used up it is refused, with the same words", async () => {
    // All but the last of the month's free scans are used up directly; the last one is still given, the next is not.
    for (let i = 0; i < MONTHLY_FREE_LIMIT - 1; i++) takeFreeScan(accountFreeKey("typed-acct-5"), MONTHLY_FREE_LIMIT);
    const last = await identify({ text: "Sony WH-1000XM4", deviceId: "typed-phone-5" }, "typed-acct-5");
    assert.equal(last.body.ok, true);
    const after = await identify({ text: "Sony WH-1000XM4", deviceId: "typed-phone-5" }, "typed-acct-5");
    assert.equal(after.body.error, "out-of-scans");
    assert.equal(after.body.scanToken, undefined);
  });

  test("it is counted as a typed scan in the cost log, so the cost per scan stays true", async () => {
    resetCostLogForTests();
    const r = await identify({ text: "Sony WH-1000XM4", deviceId: "typed-phone-7" }, "typed-acct-7");
    assert.equal(r.body.ok, true);
    const today = costReport(1).days[0];
    assert.equal(today.scansByKind.text, 1);
    assert.equal(today.scans, 1);
  });

  test("a request with no phone id is refused, as for every scan", async () => {
    const r = await identify({ text: "Sony WH-1000XM4" }, "typed-acct-6");
    assert.equal(r.status, 400);
    assert.equal(r.body.error, "missing-device");
  });
});
