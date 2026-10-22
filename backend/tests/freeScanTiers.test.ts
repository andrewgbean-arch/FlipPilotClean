import "./setupEnv";
process.env.FREE_SCAN_CAP = "on";
// A few free scans, not a hundred, so the loops below stay quick. The real default (100 a month) is pinned in freeScanDefaults.test.ts.
process.env.FREE_SCANS_PER_MONTH = "5";
delete process.env.ANONYMOUS_SCANS;
delete process.env.REVENUECAT_SECRET_KEY;

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import type { AddressInfo } from "net";
import fs from "fs";
import { dataPath } from "../config/dataDir";
import {
  ANONYMOUS_FREE_LIMIT,
  MONTHLY_FREE_LIMIT,
  accountFreeKey,
  deleteFreeScanRecord,
  freeScanRecordFor,
  freeScanStatus,
  freeScanSubject,
  purgeFreeScanRecords,
  resetDateInWords,
  takeFreeScan,
} from "../middleware/freeScanLimit";
import { scanMeter } from "../middleware/scanMeter";

// Found 2026-10-05: "5 free scans per device" was unlimited, because a device id is a string the client
// makes up. Anyone could send a new one with every request, and the whole server shares one daily
// lookup budget, so one script could use it up and show "busy" to everybody. Decided 2026-10-22: FlipPilot is
// free to use and you sign up to scan: MONTHLY_FREE_LIMIT a month per ACCOUNT, whatever phone id the request names.
// A phone that is not signed in has no free scans, unless the server's ANONYMOUS_SCANS setting is on (a lever for testing).

// The counter file as it is now ({} when nothing has been counted yet).
const readStore = (file: string) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
};

const unsavableTmp = () => dataPath(`freeScans.json.${process.pid}.tmp`);

let base = "";
let server: http.Server;

before(async () => {
  fs.writeFileSync(dataPath("credits.json"), "{}");
  const app = express();
  app.use(express.json());
  // Stands in for the real auth middleware: x-test-account says which signed-in account made the request.
  app.use((req: any, _res, next) => {
    const acc = req.headers["x-test-account"];
    if (typeof acc === "string") req.account = { id: acc };
    next();
  });
  app.get("/lookup", scanMeter, (_req, res) => res.json({ ok: true }));
  // A lookup that finds nothing: the scan must cost nothing.
  app.get("/lookup-fails", scanMeter, (_req, res) => res.json({ error: "unknown-barcode" }));
  // A lookup that finds nothing AND leaves the counter file impossible to save (a directory is in its way),
  // so the pay-back that follows cannot be written. That pay-back runs in an event handler where an error
  // is not caught: it used to be an uncaught exception, which takes the whole server down.
  app.get("/lookup-fails-unsavable", scanMeter, (_req, res) => {
    // The counter file itself stays readable (so the pay-back finds the scan to give back) but the
    // temporary file it is written through is blocked, so SAVING the pay-back fails.
    fs.mkdirSync(unsavableTmp(), { recursive: true });
    res.json({ error: "unknown-barcode" });
  });
  await new Promise<void>((ok) => {
    server = app.listen(0, "127.0.0.1", () => ok());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server?.closeAllConnections();
  server?.close();
});


// A scan that fails is paid back just AFTER its answer is sent, and on a busy Windows machine the file the
// counters live in can be locked for a moment (the server's designed answer to that is "busy"). Neither is
// the logic under test, so the tests wait for pay-backs to land and retry a "busy" a couple of times.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const settle = async (ok: () => boolean) => {
  for (let i = 0; i < 150 && !ok(); i++) await sleep(20);
};

const scan = async (device: string, account?: string, path = "/lookup") => {
  const headers: Record<string, string> = { "x-device-id": device };
  if (account) headers["x-test-account"] = account;
  let out: { status: number; body: any } = { status: 0, body: null };
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${base}${path}`, { headers });
    out = { status: res.status, body: (await res.json()) as any };
    if (out.body?.error !== "busy") break;
    await sleep(60);
  }
  return out;
};

describe("the limits themselves", () => {
  test("signed in: MONTHLY_FREE_LIMIT a month, counted under the account", () => {
    const s = freeScanSubject("whatever-phone", { id: "tier-unit-acct" });
    assert.deepEqual(s, { key: accountFreeKey("tier-unit-acct"), limit: MONTHLY_FREE_LIMIT });
    assert.equal(freeScanStatus(s.key, s.limit).left, MONTHLY_FREE_LIMIT);
    for (let i = 0; i < MONTHLY_FREE_LIMIT; i++) assert.equal(takeFreeScan(s.key, s.limit), true);
    assert.equal(takeFreeScan(s.key, s.limit), false);
  });

  test("not signed in: no free scans at all, unless the server switches anonymous scans on", () => {
    const device = "tier-unit-anon";
    const none = freeScanSubject(device, null);
    assert.deepEqual(none, { key: device, limit: 0 });
    assert.equal(takeFreeScan(none.key, none.limit), false);

    process.env.ANONYMOUS_SCANS = "on";
    try {
      const some = freeScanSubject(device, null);
      assert.deepEqual(some, { key: device, limit: ANONYMOUS_FREE_LIMIT });
      for (let i = 0; i < ANONYMOUS_FREE_LIMIT; i++) assert.equal(takeFreeScan(some.key, some.limit), true);
      assert.equal(takeFreeScan(some.key, some.limit), false);
      assert.equal(freeScanStatus(some.key, some.limit).left, 0);
    } finally {
      delete process.env.ANONYMOUS_SCANS;
    }
  });

  test("the anonymous lever accepts the usual spellings of on, and nothing else", () => {
    for (const on of ["on", "ON", " 1 ", "true", "yes"]) {
      process.env.ANONYMOUS_SCANS = on;
      assert.equal(freeScanSubject("lever-phone", null).limit, ANONYMOUS_FREE_LIMIT, on);
    }
    for (const off of ["", "off", "0", "no", "nonsense"]) {
      process.env.ANONYMOUS_SCANS = off;
      assert.equal(freeScanSubject("lever-phone", null).limit, 0, off);
    }
    delete process.env.ANONYMOUS_SCANS;
  });

  test("the allowance runs by calendar month: it resets on the first of the next one", () => {
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
    assert.equal(freeScanStatus("tier-unit-month", 5).resetsOn, first);
    assert.equal(resetDateInWords("2026-11-01"), "1 November");
    assert.equal(resetDateInWords("2027-01-01"), "1 January");
  });

  test("a counter written in the old weekly days matches no month, so it simply starts again at zero", () => {
    const key = "tier-unit-legacy";
    const file = dataPath("freeScans.json");
    const store = readStore(file);
    store[key] = { weekStart: "2026-10-19", count: 5 };
    fs.writeFileSync(file, JSON.stringify(store));
    assert.equal(freeScanStatus(key, 5).used, 0);
    assert.equal(takeFreeScan(key, 5), true);
    assert.equal(freeScanRecordFor(key)?.count, 1);
    // filed under the first day of THIS month, so it carries on all month and starts again on the first of the next
    const now = new Date();
    assert.equal(freeScanRecordFor(key)?.periodStart, new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10));
  });

  test("old counters, monthly or from the weekly days, are purged once long over, and this month's are kept", () => {
    const file = dataPath("freeScans.json");
    const store = readStore(file);
    store["purge-old-month"] = { periodStart: "2026-06-01", count: 3 };
    store["purge-old-week"] = { weekStart: "2026-06-01", count: 2 };
    fs.writeFileSync(file, JSON.stringify(store));
    takeFreeScan("purge-this-month", 5);
    const removed = purgeFreeScanRecords(30, new Date());
    assert.ok(removed >= 2, `removed ${removed}`);
    assert.equal(freeScanRecordFor("purge-old-month"), null);
    assert.equal(freeScanRecordFor("purge-old-week"), null);
    assert.equal(freeScanRecordFor("purge-this-month")?.count, 1);
  });

  test("an account\x27s counter can be exported and forgotten", () => {
    const key = accountFreeKey("tier-unit-erase");
    takeFreeScan(key, MONTHLY_FREE_LIMIT);
    assert.equal(freeScanRecordFor(key)?.count, 1);
    assert.equal(deleteFreeScanRecord(key), true);
    assert.equal(freeScanRecordFor(key), null);
    assert.equal(deleteFreeScanRecord(key), false);
  });
});

describe("a pay-back that cannot be saved", () => {
  test("does not take the server down, and the server carries on afterwards", async () => {
    const uncaught: unknown[] = [];
    const listener = (err: unknown) => uncaught.push(err);
    process.on("uncaughtException", listener);
    try {
      const r = await scan("tier-unsavable-phone", "tier-unsavable-acct", "/lookup-fails-unsavable");
      assert.equal(r.body.error, "unknown-barcode");
      // Give the pay-back time to run (it retries briefly) and fail.
      await sleep(900);
      assert.deepEqual(uncaught, [], "the failed pay-back must not surface as an uncaught exception");
    } finally {
      process.off("uncaughtException", listener);
      fs.rmSync(unsavableTmp(), { force: true, recursive: true });
    }
    // And the meter still works.
    assert.equal((await scan("tier-after-unsavable-phone", "tier-after-unsavable-acct")).body.ok, true);
  });
});

describe("through the meter", () => {
  test("not signed in: refused, and asked to sign up (it is free)", async () => {
    const r = await scan("tier-route-anon");
    assert.equal(r.body.error, "free-scan-limit", "the code the app already turns into a Sign in prompt");
    assert.equal(r.body.signedIn, false);
    assert.equal(r.body.signInRequired, true);
    assert.match(r.body.message, /Sign in to start scanning/);
    assert.match(r.body.message, new RegExp(`${MONTHLY_FREE_LIMIT} free scans a month`));
  });

  test("signed in: the free scans, then out-of-scans with the way on (go Pro) and the date they come back", async () => {
    const account = "tier-route-acct-basic";
    for (let i = 0; i < MONTHLY_FREE_LIMIT; i++) assert.equal((await scan("a-phone", account)).body.ok, true, `scan ${i + 1}`);
    const after = await scan("a-phone", account);
    assert.equal(after.body.error, "out-of-scans");
    assert.equal(after.body.signedIn, true);
    assert.match(after.body.message, new RegExp(`used your ${MONTHLY_FREE_LIMIT} free scans this month`));
    assert.match(after.body.message, /Go Pro for unlimited scans/);
    assert.match(after.body.message, /come back on 1 /, "the reset date is in words, not 2026-11-01");
    assert.ok(after.body.resetsOn);
  });

  test("made-up phone ids do NOT give a signed-in account more than its own allowance", async () => {
    const account = "tier-route-acct-hopper";
    let allowed = 0;
    for (let i = 0; i < MONTHLY_FREE_LIMIT + 4; i++) {
      const r = await scan(`fresh-made-up-device-${i}`, account);
      if (r.body.ok) allowed++;
    }
    assert.equal(allowed, MONTHLY_FREE_LIMIT);
    const after = await scan("yet-another-made-up-device", account);
    assert.equal(after.body.error, "out-of-scans");
  });

  test("two accounts are counted separately", async () => {
    for (let i = 0; i < MONTHLY_FREE_LIMIT; i++) assert.equal((await scan("shared-phone", "tier-route-acct-a")).body.ok, true);
    assert.equal((await scan("shared-phone", "tier-route-acct-a")).body.error, "out-of-scans");
    assert.equal((await scan("shared-phone", "tier-route-acct-b")).body.ok, true);
  });

  test("a scan that finds nothing costs nothing", async () => {
    const account = "tier-route-fails-acct";
    for (let i = 0; i < MONTHLY_FREE_LIMIT + 3; i++) assert.equal((await scan("any-phone", account, "/lookup-fails")).body.error, "unknown-barcode");
    await settle(() => freeScanStatus(accountFreeKey(account), MONTHLY_FREE_LIMIT).used === 0);
    for (let i = 0; i < MONTHLY_FREE_LIMIT; i++) assert.equal((await scan("any-phone", account)).body.ok, true);
  });

  test("with anonymous scans switched on, a phone gets a few, then is asked to sign in", async () => {
    process.env.ANONYMOUS_SCANS = "on";
    try {
      const device = "tier-route-anon-on";
      for (let i = 0; i < ANONYMOUS_FREE_LIMIT; i++) assert.equal((await scan(device)).body.ok, true, `anonymous scan ${i + 1}`);
      const next = await scan(device);
      assert.equal(next.body.error, "free-scan-limit");
      assert.equal(next.body.signedIn, false);
      assert.match(next.body.message, /without an account/);
      assert.match(next.body.message, new RegExp(`${MONTHLY_FREE_LIMIT} free scans a month`));
    } finally {
      delete process.env.ANONYMOUS_SCANS;
    }
  });
});
