import "./setupEnv";
process.env.FREE_SCAN_CAP = "on";
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
  WEEKLY_FREE_LIMIT,
  accountFreeKey,
  deleteFreeScanRecord,
  freeScanRecordFor,
  freeScanStatus,
  freeScanSubject,
  takeFreeScan,
} from "../middleware/freeScanLimit";
import { scanMeter } from "../middleware/scanMeter";

// Found 2026-10-05: "5 free scans per device" was unlimited, because a device id is a string the client
// makes up. Anyone could send a new one with every request, and the whole server shares one daily
// lookup budget, so one script could use it up and show "busy" to everybody. Now: 2 a week without an
// account (per phone), 5 a week with one (per ACCOUNT, whatever phone id the request names).

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
  test("not signed in: ANONYMOUS_FREE_LIMIT a week, counted per phone", () => {
    const device = "tier-unit-anon";
    const s = freeScanSubject(device, null);
    assert.deepEqual(s, { key: device, limit: ANONYMOUS_FREE_LIMIT });
    for (let i = 0; i < ANONYMOUS_FREE_LIMIT; i++) assert.equal(takeFreeScan(s.key, s.limit), true);
    assert.equal(takeFreeScan(s.key, s.limit), false);
    assert.equal(freeScanStatus(s.key, s.limit).left, 0);
  });

  test("signed in: WEEKLY_FREE_LIMIT a week, counted under the account", () => {
    const s = freeScanSubject("whatever-phone", { id: "tier-unit-acct" });
    assert.deepEqual(s, { key: accountFreeKey("tier-unit-acct"), limit: WEEKLY_FREE_LIMIT });
    assert.equal(freeScanStatus(s.key, s.limit).left, WEEKLY_FREE_LIMIT);
  });

  test("the limits are what the owner chose, and signing in is worth more than not", () => {
    assert.equal(ANONYMOUS_FREE_LIMIT, 2);
    assert.equal(WEEKLY_FREE_LIMIT, 5);
  });

  test("an account\x27s counter can be exported and forgotten", () => {
    const key = accountFreeKey("tier-unit-erase");
    takeFreeScan(key, WEEKLY_FREE_LIMIT);
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
      const r = await scan("tier-unsavable-phone", undefined, "/lookup-fails-unsavable");
      assert.equal(r.body.error, "unknown-barcode");
      // Give the pay-back time to run (it retries briefly) and fail.
      await sleep(900);
      assert.deepEqual(uncaught, [], "the failed pay-back must not surface as an uncaught exception");
    } finally {
      process.off("uncaughtException", listener);
      fs.rmSync(unsavableTmp(), { force: true, recursive: true });
    }
    // And the meter still works.
    assert.equal((await scan("tier-after-unsavable-phone")).body.ok, true);
  });
});

describe("through the meter", () => {
  test("not signed in: two scans, then it asks them to sign in", async () => {
    const device = "tier-route-anon";
    assert.equal((await scan(device)).body.ok, true);
    assert.equal((await scan(device)).body.ok, true);
    const third = await scan(device);
    assert.equal(third.body.error, "free-scan-limit");
    assert.equal(third.body.signedIn, false);
    assert.match(third.body.message, /Sign in/);
    assert.match(third.body.message, new RegExp(`${WEEKLY_FREE_LIMIT} free scans a week`));
  });

  test("made-up phone ids do NOT give a signed-in account more than its own five", async () => {
    const account = "tier-route-acct-hopper";
    let allowed = 0;
    for (let i = 0; i < WEEKLY_FREE_LIMIT + 4; i++) {
      const r = await scan(`fresh-made-up-device-${i}`, account);
      if (r.body.ok) allowed++;
    }
    assert.equal(allowed, WEEKLY_FREE_LIMIT);
    // And the one after that is the out-of-credits answer for a signed-in account, not a free scan.
    const after = await scan("yet-another-made-up-device", account);
    assert.equal(after.body.error, "out-of-credits");
    assert.equal(after.body.signedIn, true);
  });

  test("two accounts are counted separately", async () => {
    for (let i = 0; i < WEEKLY_FREE_LIMIT; i++) assert.equal((await scan("shared-phone", "tier-route-acct-a")).body.ok, true);
    assert.equal((await scan("shared-phone", "tier-route-acct-a")).body.error, "out-of-credits");
    assert.equal((await scan("shared-phone", "tier-route-acct-b")).body.ok, true);
  });

  test("signing in gives the account its own five, however many the phone used before", async () => {
    const device = "tier-route-signs-in-later";
    await scan(device);
    await scan(device);
    assert.equal((await scan(device)).body.error, "free-scan-limit");
    for (let i = 0; i < WEEKLY_FREE_LIMIT; i++) assert.equal((await scan(device, "tier-route-acct-later")).body.ok, true, `signed-in scan ${i + 1}`);
    assert.equal((await scan(device, "tier-route-acct-later")).body.error, "out-of-credits");
  });

  test("a scan that finds nothing costs nothing, signed in or not", async () => {
    const device = "tier-route-fails-anon";
    for (let i = 0; i < ANONYMOUS_FREE_LIMIT + 3; i++) assert.equal((await scan(device, undefined, "/lookup-fails")).body.error, "unknown-barcode");
    // None of those used a free scan, so both real scans still work.
    await settle(() => freeScanStatus(device, ANONYMOUS_FREE_LIMIT).used === 0);
    assert.equal((await scan(device)).body.ok, true);
    assert.equal((await scan(device)).body.ok, true);

    const account = "tier-route-fails-acct";
    for (let i = 0; i < WEEKLY_FREE_LIMIT + 3; i++) assert.equal((await scan("any-phone", account, "/lookup-fails")).body.error, "unknown-barcode");
    await settle(() => freeScanStatus(accountFreeKey(account), WEEKLY_FREE_LIMIT).used === 0);
    for (let i = 0; i < WEEKLY_FREE_LIMIT; i++) assert.equal((await scan("any-phone", account)).body.ok, true);
  });
});
