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
import { ANONYMOUS_FREE_LIMIT, ANONYMOUS_FREE_PER_ADDRESS, WEEKLY_FREE_LIMIT, addressScansLeft } from "../middleware/freeScanLimit";
import { scanMeter } from "../middleware/scanMeter";

// A device id is a string the client makes up, so a limit per device alone cannot stop a script: send a
// new id with every request and every request is somebody's first. The one thing a script cannot make up
// is its network address, so the scans of everyone NOT signed in behind one address share an allowance.
// Signing in (free) is the way past it.

let base = "";
let server: http.Server;
let myAddress = "";

before(async () => {
  fs.writeFileSync(dataPath("credits.json"), "{}");
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const acc = req.headers["x-test-account"];
    if (typeof acc === "string") req.account = { id: acc };
    next();
  });
  app.get("/my-address", (req, res) => res.json({ ip: req.ip }));
  app.get("/lookup", scanMeter, (_req, res) => res.json({ ok: true }));
  app.get("/lookup-fails", scanMeter, (_req, res) => res.json({ error: "unknown-barcode" }));
  await new Promise<void>((ok) => {
    server = app.listen(0, "127.0.0.1", () => ok());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // The address the server sees for this test client, spelled the way the server spells it.
  myAddress = ((await (await fetch(`${base}/my-address`)).json()) as any).ip;
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
  let body: any = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    body = (await (await fetch(`${base}${path}`, { headers })).json()) as any;
    if (body.error !== "busy") break;
    await sleep(60);
  }
  return body;
};

describe("anonymous scans share one allowance per network address", () => {
  test("it is generous enough for a household or a stall's wifi, and bigger than one phone's", () => {
    assert.ok(ANONYMOUS_FREE_PER_ADDRESS >= 20);
    assert.ok(ANONYMOUS_FREE_PER_ADDRESS > ANONYMOUS_FREE_LIMIT * 5);
  });

  test("a scan that could not even be counted (counter file unwritable) does not use the address's allowance", async () => {
    const file = dataPath("freeScans.json");
    fs.rmSync(file, { force: true, recursive: true });
    fs.mkdirSync(file); // saving the counter now fails
    try {
      const r = await scan("addr-unsavable-phone");
      assert.equal(r.error, "busy");
    } finally {
      fs.rmSync(file, { force: true, recursive: true });
    }
    assert.equal(addressScansLeft(myAddress), ANONYMOUS_FREE_PER_ADDRESS);
  });

  test("failed scans and exhausted phones do not use the address's allowance", async () => {
    // Scans that find nothing cost nothing, so they must not use the address up either.
    for (let i = 0; i < ANONYMOUS_FREE_PER_ADDRESS + 10; i++) {
      assert.equal((await scan(`addr-fail-${i}`, undefined, "/lookup-fails")).error, "unknown-barcode");
    }
    await settle(() => addressScansLeft(myAddress) === ANONYMOUS_FREE_PER_ADDRESS);
    assert.equal(addressScansLeft(myAddress), ANONYMOUS_FREE_PER_ADDRESS);

    // One phone asking ten times uses two of the address's scans, not ten.
    let passed = 0;
    for (let i = 0; i < 10; i++) if ((await scan("addr-one-phone")).ok) passed++;
    assert.equal(passed, ANONYMOUS_FREE_LIMIT);
    await settle(() => addressScansLeft(myAddress) === ANONYMOUS_FREE_PER_ADDRESS - ANONYMOUS_FREE_LIMIT);
    assert.equal(addressScansLeft(myAddress), ANONYMOUS_FREE_PER_ADDRESS - ANONYMOUS_FREE_LIMIT);
  });

  test("made-up device ids from one address run out, and are told to sign in", async () => {
    // Two are already used by the phone above; every new made-up id is somebody's first scan.
    let passed = ANONYMOUS_FREE_LIMIT;
    let firstRefusal: any = null;
    for (let i = 0; i < ANONYMOUS_FREE_PER_ADDRESS + 20; i++) {
      const r = await scan(`addr-made-up-${i}`);
      if (r.ok) passed++;
      else if (!firstRefusal) firstRefusal = r;
    }
    assert.equal(passed, ANONYMOUS_FREE_PER_ADDRESS, "exactly the address's allowance gets through, however many ids are used");
    assert.equal(firstRefusal.error, "free-scan-limit");
    assert.equal(firstRefusal.signedIn, false);
    assert.match(firstRefusal.message, /this network/);
    assert.match(firstRefusal.message, /Sign in/);
    assert.equal(addressScansLeft(myAddress), 0);
  });

  test("signing in gets past it: an account is not limited by the address", async () => {
    for (let i = 0; i < WEEKLY_FREE_LIMIT; i++) {
      const r = await scan(`addr-signed-in-phone-${i}`, "addr-account-1");
      assert.equal(r.ok, true, `signed-in scan ${i + 1}`);
    }
  });

  test("a phone that is not signed in is still refused once the address is used up, even on its first scan", async () => {
    const r = await scan("addr-brand-new-phone");
    assert.equal(r.error, "free-scan-limit");
  });
});
