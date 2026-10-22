import "./setupEnv";
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import type { AddressInfo } from "net";

// The Pro plan (4.99 pounds a month, decided 22 Oct 2026): after an account's free scans for the month, a subscriber
// scans on unlimited, up to a fair-use ceiling a day (3 here, 150 for real), then any scan credits, then a clear stop.
// The plan is known by the phone (the id RevenueCat knows the subscriber by); scanning needs an account.
// RevenueCat is played by a small local server, so nothing real is asked.

process.env.FREE_SCAN_CAP = "on";
process.env.FREE_SCANS_PER_MONTH = "2";
process.env.PRO_DAILY_SCANS = "3";
delete process.env.ANONYMOUS_SCANS;
delete process.env.CREDIT_PACKS_ON_SALE;
process.env.REVENUECAT_SECRET_KEY = "sk_test_fake_key_for_tests_only";

const FUTURE = new Date(Date.now() + 20 * 86400e3).toISOString();
const PAST = new Date(Date.now() - 86400e3).toISOString();

// What the fake RevenueCat says about each phone.
function subscriberFor(id: string): any | null {
  if (id.startsWith("pro-phone")) return { entitlements: { pro: { expires_date: FUTURE, purchase_date: "2026-10-05T10:00:00Z" } } };
  if (id === "old-trader-phone") return { entitlements: { trader: { expires_date: FUTURE, purchase_date: "2026-09-01T10:00:00Z" } } };
  if (id === "lapsed-phone") return { entitlements: { pro: { expires_date: PAST, purchase_date: "2026-07-01T10:00:00Z" } } };
  return null;
}

let rc: http.Server;
let app: http.Server;
let base = "";
let mod: {
  planStatus: typeof import("../subscriptions/revenueCat").planStatus;
  proScanRecordFor: typeof import("../utils/proAllowance").proScanRecordFor;
  takeProScan: typeof import("../utils/proAllowance").takeProScan;
  purgeProScanRecords: typeof import("../utils/proAllowance").purgeProScanRecords;
  returnProScan: typeof import("../utils/proAllowance").returnProScan;
  utcDay: typeof import("../utils/proAllowance").utcDay;
  googleAccessFor: typeof import("../utils/googleAccess").googleAccessFor;
  MONTHLY_FREE_LIMIT: number;
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
  const allowance = await import("../utils/proAllowance.js");
  const limits = await import("../middleware/freeScanLimit.js");
  const access = await import("../utils/googleAccess.js");
  const { scanMeter } = await import("../middleware/scanMeter.js");
  const { sellingGate } = await import("../middleware/sellingGate.js");
  // A default export from a module this file loads late: depending on how it is loaded, the function is one level further in.
  const creditsModule: any = await import("../routes/credits.js");
  const registerCreditsRoutes: (app: express.Express) => void = creditsModule.default?.default ?? creditsModule.default;
  mod = { planStatus: rcMod.planStatus, MONTHLY_FREE_LIMIT: limits.MONTHLY_FREE_LIMIT, googleAccessFor: access.googleAccessFor, ...allowance };

  const server = express();
  server.use(express.json());
  // Stands in for the real auth middleware: x-test-account says which signed-in account made the request.
  server.use((req: any, _res, next) => {
    const acc = req.headers["x-test-account"];
    if (typeof acc === "string") req.account = { id: acc, canonicalDeviceId: String(req.headers["x-device-id"] ?? "") };
    next();
  });
  // A lookup that succeeds, or reports a failure the way the real ones do.
  server.get("/lookup", scanMeter, (req, res) => {
    if (req.query.fail) return res.json({ error: "Nothing found" });
    res.json({ ok: true });
  });
  server.post("/export", sellingGate, (_req, res) => res.json({ ok: true }));
  registerCreditsRoutes(server);
  await new Promise<void>((ok) => {
    app = server.listen(0, "127.0.0.1", () => ok());
  });
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
});

after(() => {
  app?.closeAllConnections();
  app?.close();
  rc?.close();
});

const scan = async (deviceId: string, account: string | null, fail = false) => {
  const headers: Record<string, string> = { "x-device-id": deviceId };
  if (account) headers["x-test-account"] = account;
  const res = await fetch(`${base}/lookup?deviceId=${deviceId}${fail ? "&fail=1" : ""}`, { headers });
  return (await res.json()) as any;
};
// Waits for the response's "finish" handler (the pay-back) to have run.
const settle = () => new Promise((ok) => setTimeout(ok, 40));

describe("the Pro plan's unlimited scans (with a fair-use ceiling a day)", () => {
  test("free scans are used first, then Pro's, then it stops and says it is today's fair-use limit", async () => {
    for (let i = 0; i < mod.MONTHLY_FREE_LIMIT; i++) assert.equal((await scan("pro-phone", "pro-acct-1")).ok, true, `free scan ${i + 1}`);
    assert.equal(mod.proScanRecordFor("pro-phone"), null, "the free ones don't touch Pro's count");
    for (let i = 0; i < 3; i++) assert.equal((await scan("pro-phone", "pro-acct-1")).ok, true, `Pro scan ${i + 1}`);
    assert.deepEqual(mod.proScanRecordFor("pro-phone"), { day: mod.utcDay(), used: 3 });
    const refused = await scan("pro-phone", "pro-acct-1");
    assert.equal(refused.error, "pro-daily-limit");
    assert.match(refused.message, /fair-use limit of 3 scans/);
    assert.match(refused.message, /starts again tomorrow/);
    assert.doesNotMatch(refused.message, /Go Pro/, "a subscriber is never told to go Pro");
  });

  test("a lookup that finds nothing gives the scan back", async () => {
    for (let i = 0; i < mod.MONTHLY_FREE_LIMIT; i++) await scan("pro-phone-2", "pro-acct-2");
    assert.equal((await scan("pro-phone-2", "pro-acct-2", true)).error, "Nothing found");
    await settle();
    assert.equal(mod.proScanRecordFor("pro-phone-2")?.used ?? 0, 0);
    assert.equal((await scan("pro-phone-2", "pro-acct-2")).ok, true);
    assert.equal(mod.proScanRecordFor("pro-phone-2")?.used, 1);
  });

  test("a subscriber under the plan's earlier name, Trader, still gets it", async () => {
    assert.equal((await mod.planStatus("old-trader-phone")).active, true);
    for (let i = 0; i < mod.MONTHLY_FREE_LIMIT; i++) await scan("old-trader-phone", "trader-acct");
    assert.equal((await scan("old-trader-phone", "trader-acct")).ok, true);
  });

  test("a lapsed plan, or no plan, gives nothing beyond the free scans, and says how to go on", async () => {
    for (const [phone, account] of [["lapsed-phone", "lapsed-acct"], ["stranger-phone", "stranger-acct"]]) {
      for (let i = 0; i < mod.MONTHLY_FREE_LIMIT; i++) await scan(phone, account);
      const r = await scan(phone, account);
      assert.equal(r.error, "out-of-scans", phone);
      assert.match(r.message, /Go Pro for unlimited scans/);
      assert.equal(mod.proScanRecordFor(phone), null);
    }
  });

  test("a subscriber still has to sign in: scanning needs an account", async () => {
    const r = await scan("pro-phone", null);
    assert.equal(r.error, "free-scan-limit");
    assert.equal(r.signInRequired, true);
  });

  test("the daily count starts again each day, and a scan given back after midnight does not touch the new day", () => {
    assert.equal(mod.takeProScan("edge-phone", "day-A"), true);
    mod.returnProScan("edge-phone", "day-B");
    assert.deepEqual(mod.proScanRecordFor("edge-phone"), { day: "day-A", used: 1 });
    assert.equal(mod.takeProScan("edge-phone", "day-A"), true);
    assert.equal(mod.takeProScan("edge-phone", "day-A"), true);
    assert.equal(mod.takeProScan("edge-phone", "day-A"), false, "the fourth scan of the day is over the ceiling of 3");
    assert.equal(mod.takeProScan("edge-phone", "day-B"), true, "a new day starts at zero");
  });

  test("counters from days that are over are tidied away by the retention job; today's stay", () => {
    mod.takeProScan("tidy-old-phone", "2026-01-01");
    mod.takeProScan("tidy-today-phone");
    assert.ok(mod.purgeProScanRecords() >= 1, "the old day's counter went");
    assert.equal(mod.proScanRecordFor("tidy-old-phone"), null);
    assert.deepEqual(mod.proScanRecordFor("tidy-today-phone"), { day: mod.utcDay(), used: 1 });
    assert.equal(mod.purgeProScanRecords(), 0, "nothing left to tidy");
  });
});

describe("Google shop-price checks come with the Pro plan", () => {
  test("a subscriber may have one; a stranger may not; no phone id may not", async () => {
    assert.equal(await mod.googleAccessFor("pro-phone"), true);
    assert.equal(await mod.googleAccessFor("old-trader-phone"), true);
    assert.equal(await mod.googleAccessFor("stranger-phone"), false);
    assert.equal(await mod.googleAccessFor("lapsed-phone"), false);
    assert.equal(await mod.googleAccessFor(null), false);
    assert.equal(await mod.googleAccessFor(""), false);
  });

  test("a phone named in SELLING_ALLOWED_DEVICE_IDS (the owner's test phones) may too", async () => {
    process.env.SELLING_ALLOWED_DEVICE_IDS = "owner-test-phone, another";
    try {
      assert.equal(await mod.googleAccessFor("owner-test-phone"), true);
      assert.equal(await mod.googleAccessFor("not-listed"), false);
    } finally {
      delete process.env.SELLING_ALLOWED_DEVICE_IDS;
    }
  });
});

describe("eBay export", () => {
  test("comes with the Pro plan", async () => {
    const post = (deviceId: string) =>
      fetch(`${base}/export`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceId }) });
    const no = await post("stranger-phone");
    assert.equal(no.status, 403);
    assert.match(((await no.json()) as any).message, /Pro plan/);
    assert.equal((await post("pro-phone")).status, 200);
    assert.equal((await post("old-trader-phone")).status, 200);
  });
});

describe("what the app is told about its allowance (GET /credits)", () => {
  const credits = async (deviceId: string, account: string | null) => {
    const headers: Record<string, string> = { "x-device-id": deviceId };
    if (account) headers["x-test-account"] = account;
    return (await (await fetch(`${base}/credits?deviceId=${deviceId}`, { headers })).json()) as any;
  };

  test("signed in: a monthly allowance, the plan, the ceiling, and no packs for sale", async () => {
    const r = await credits("stranger-phone", "credits-acct-new");
    assert.equal(r.ok, true);
    assert.equal(r.signedIn, true);
    assert.equal(r.period, "month");
    assert.equal(r.signedInFreeLimit, mod.MONTHLY_FREE_LIMIT);
    assert.deepEqual(r.free?.limit, mod.MONTHLY_FREE_LIMIT);
    assert.deepEqual(r.plan, { active: false, renewsOn: null });
    assert.equal(r.proDailyLimit, 3);
    assert.deepEqual(r.packs, [], "credit packs are retired");
    assert.equal(r.accountRequired, true);
  });

  test("not signed in: no free scans, and the app is told an account is required", async () => {
    const r = await credits("stranger-phone", null);
    assert.equal(r.signedIn, false);
    assert.equal(r.accountRequired, true);
    assert.equal(r.free?.limit, 0);
    assert.equal(r.free?.left, 0);
  });

  test("a subscriber is shown as on Pro, with the date it renews", async () => {
    const r = await credits("pro-phone", "credits-acct-pro");
    assert.equal(r.plan.active, true);
    assert.ok(r.plan.renewsOn);
  });

  test("the packs come back only if the server is told to sell them again", async () => {
    process.env.CREDIT_PACKS_ON_SALE = "1";
    try {
      const r = await credits("stranger-phone", "credits-acct-packs");
      assert.equal(r.packs.length, 4);
    } finally {
      delete process.env.CREDIT_PACKS_ON_SALE;
    }
  });
});
