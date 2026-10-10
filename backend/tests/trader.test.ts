import "./setupEnv";
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import type { AddressInfo } from "net";
import { ANONYMOUS_FREE_LIMIT } from "../middleware/freeScanLimit";

// The Trader plan: after the free weekly scans (a phone that is not signed in has ANONYMOUS_FREE_LIMIT of
// them; a subscriber is known by the phone, so they need no account), a subscriber gets a monthly allowance
// (3 here, 300 for real), then scan credits. RevenueCat is played by a small local server, so nothing real is asked.

process.env.FREE_SCAN_CAP = "on";
process.env.TRADER_MONTHLY_SCANS = "3";
process.env.REVENUECAT_SECRET_KEY = "sk_test_fake_key_for_tests_only";

const FUTURE = new Date(Date.now() + 20 * 86400e3).toISOString();
const PAST = new Date(Date.now() - 86400e3).toISOString();
let traderPaidOn = "2026-09-01T10:00:00Z";

// What the fake RevenueCat says about each phone.
function subscriberFor(id: string): any | null {
  if (id === "trader-phone" || id === "renewing-phone")
    return { entitlements: { trader: { expires_date: FUTURE, purchase_date: id === "renewing-phone" ? traderPaidOn : "2026-09-01T10:00:00Z" } } };
  if (id === "old-pro-phone") return { entitlements: { pro: { expires_date: FUTURE, purchase_date: "2026-09-05T10:00:00Z" } } };
  if (id === "lapsed-phone") return { entitlements: { trader: { expires_date: PAST, purchase_date: "2026-07-01T10:00:00Z" } } };
  return null;
}

let rc: http.Server;
let app: http.Server;
let base = "";
let mod: {
  planStatus: typeof import("../subscriptions/revenueCat").planStatus;
  clearPlanCache: typeof import("../subscriptions/revenueCat").clearPlanCache;
  traderScanRecordFor: typeof import("../utils/traderAllowance").traderScanRecordFor;
  takeTraderScan: typeof import("../utils/traderAllowance").takeTraderScan;
  returnTraderScan: typeof import("../utils/traderAllowance").returnTraderScan;
};

before(async () => {
  rc = http.createServer((req, res) => {
    const id = decodeURIComponent((req.url ?? "").split("/v1/subscribers/")[1] ?? "");
    const sub = req.headers.authorization === "Bearer sk_test_fake_key_for_tests_only" ? subscriberFor(id) : null;
    res.writeHead(sub ? 200 : 404, { "content-type": "application/json" });
    res.end(JSON.stringify(sub ? { subscriber: sub } : { code: 7259, message: "not found" }));
  });
  await new Promise<void>((ok) => rc.listen(0, "127.0.0.1", () => ok()));
  process.env.REVENUECAT_API_BASE = `http://127.0.0.1:${(rc.address() as AddressInfo).port}`;

  // Imported only now: these read their settings when first loaded.
  const rcMod = await import("../subscriptions/revenueCat.js");
  const allowance = await import("../utils/traderAllowance.js");
  const { scanMeter } = await import("../middleware/scanMeter.js");
  const { sellingGate } = await import("../middleware/sellingGate.js");
  mod = { planStatus: rcMod.planStatus, clearPlanCache: rcMod.clearPlanCache, ...allowance };

  const server = express();
  server.use(express.json());
  // A lookup that succeeds, or reports a failure the way the real ones do.
  server.get("/lookup", scanMeter, (req, res) => {
    if (req.query.fail) return res.json({ error: "Nothing found" });
    res.json({ ok: true });
  });
  server.post("/export", sellingGate, (_req, res) => res.json({ ok: true }));
  await new Promise<void>((ok) => {
    app = server.listen(0, "127.0.0.1", () => ok());
  });
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
});

after(() => {
  app?.close();
  rc?.close();
});

const scan = async (deviceId: string, fail = false) => {
  const res = await fetch(`${base}/lookup?deviceId=${deviceId}${fail ? "&fail=1" : ""}`);
  return (await res.json()) as any;
};
// Waits for the response's "finish" handler (the pay-back) to have run.
const settle = () => new Promise((ok) => setTimeout(ok, 30));

describe("the Trader plan's monthly scans", () => {
  test("free scans are used first, then the plan's, then it stops and says when they come back", async () => {
    for (let i = 0; i < ANONYMOUS_FREE_LIMIT; i++) assert.equal((await scan("trader-phone")).ok, true, `free scan ${i + 1}`);
    assert.equal(mod.traderScanRecordFor("trader-phone"), null, "the free ones don't touch the plan's count");
    for (let i = 0; i < 3; i++) assert.equal((await scan("trader-phone")).ok, true, `Trader scan ${i + 1}`);
    assert.deepEqual(mod.traderScanRecordFor("trader-phone"), { period: "2026-09-01T10:00:00Z", used: 3 });
    const refused = await scan("trader-phone");
    assert.equal(refused.error, "free-scan-limit");
    assert.match(refused.message, /Trader scans come back when your plan renews on/);
  });

  test("a lookup that finds nothing gives the scan back", async () => {
    for (let i = 0; i < ANONYMOUS_FREE_LIMIT; i++) await scan("old-pro-phone");
    assert.equal((await scan("old-pro-phone", true)).error, "Nothing found");
    await settle();
    assert.equal(mod.traderScanRecordFor("old-pro-phone")?.used ?? 0, 0);
    assert.equal((await scan("old-pro-phone")).ok, true);
    assert.equal(mod.traderScanRecordFor("old-pro-phone")?.used, 1);
  });

  test("a subscriber under the plan's old name, Pro, still gets it", async () => {
    assert.equal((await mod.planStatus("old-pro-phone")).active, true);
  });

  test("a renewal starts a fresh month", async () => {
    for (let i = 0; i < ANONYMOUS_FREE_LIMIT; i++) await scan("renewing-phone");
    for (let i = 0; i < 3; i++) await scan("renewing-phone");
    assert.equal((await scan("renewing-phone")).error, "free-scan-limit");
    traderPaidOn = "2026-10-01T10:00:00Z";
    mod.clearPlanCache();
    assert.equal((await scan("renewing-phone")).ok, true);
    assert.deepEqual(mod.traderScanRecordFor("renewing-phone"), { period: "2026-10-01T10:00:00Z", used: 1 });
  });

  test("a lapsed plan, or no plan, gives nothing beyond the free scans", async () => {
    for (const id of ["lapsed-phone", "stranger-phone"]) {
      for (let i = 0; i < ANONYMOUS_FREE_LIMIT; i++) await scan(id);
      const r = await scan(id);
      assert.equal(r.error, "free-scan-limit", id);
      assert.doesNotMatch(r.message, /Trader/);
      assert.equal(mod.traderScanRecordFor(id), null);
    }
  });

  test("a scan given back after a renewal doesn't touch the new month", () => {
    assert.equal(mod.takeTraderScan("edge-phone", "period-A"), true);
    mod.returnTraderScan("edge-phone", "period-B");
    assert.deepEqual(mod.traderScanRecordFor("edge-phone"), { period: "period-A", used: 1 });
  });
});

describe("eBay export", () => {
  test("comes with the Trader plan", async () => {
    const post = (deviceId: string) =>
      fetch(`${base}/export`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceId }) });
    const no = await post("stranger-phone");
    assert.equal(no.status, 403);
    assert.match(((await no.json()) as any).message, /Trader plan/);
    assert.equal((await post("trader-phone")).status, 200);
  });
});
