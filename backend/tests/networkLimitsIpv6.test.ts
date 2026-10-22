import "./setupEnv";
process.env.FREE_SCAN_CAP = "on";
// These tests are about the allowance anonymous scans share per network, so anonymous scans are switched on (they are off by default).
process.env.ANONYMOUS_SCANS = "on";
delete process.env.REVENUECAT_SECRET_KEY;

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import type { AddressInfo } from "net";
import fs from "fs";
import { dataPath } from "../config/dataDir";
import { ANONYMOUS_FREE_PER_ADDRESS } from "../middleware/freeScanLimit";
import { scanMeter } from "../middleware/scanMeter";
import { rateLimit } from "../middleware/rateLimit";

// An ordinary home or phone connection owns a whole IPv6 /64 (billions of addresses). If limits counted
// each address separately, a script could send every request from a different one and get a fresh
// allowance each time. Limits must count the /64 as ONE network. (trust proxy is on here so the test can
// say which address each request "comes from" with X-Forwarded-For, as the real server's proxy does.)

let base = "";
let server: http.Server;

before(async () => {
  fs.writeFileSync(dataPath("credits.json"), "{}");
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  app.get("/lookup", scanMeter, (_req, res) => res.json({ ok: true }));
  app.get("/limited", rateLimit(3), (_req, res) => res.json({ ok: true }));
  await new Promise<void>((ok) => {
    server = app.listen(0, "127.0.0.1", () => ok());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server?.closeAllConnections();
  server?.close();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// "busy" is the server's designed answer to a briefly locked counter file (Windows); retry it.
const scanFrom = async (device: string, from: string) => {
  let body: any = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    body = (await (await fetch(`${base}/lookup`, { headers: { "x-device-id": device, "x-forwarded-for": from } })).json()) as any;
    if (body.error !== "busy") break;
    await sleep(60);
  }
  return body;
};

describe("anonymous scans: an IPv6 /64 is one network", () => {
  test("hopping between addresses in one /64 does not give a fresh allowance", async () => {
    let passed = 0;
    for (let i = 0; i < ANONYMOUS_FREE_PER_ADDRESS + 12; i++) {
      // Every request: a new made-up phone AND a different address in the same /64.
      const r = await scanFrom(`v6-hopper-${i}`, `2001:db8:aaaa:bbbb:${(i + 1).toString(16)}:${(i * 7 + 3).toString(16)}::1`);
      if (r.ok) passed++;
    }
    assert.equal(passed, ANONYMOUS_FREE_PER_ADDRESS, "exactly the network's allowance, however many addresses are used");
  });

  test("a different /64 is a different network with its own allowance", async () => {
    assert.equal((await scanFrom("v6-neighbour", "2001:db8:aaaa:cccc::1")).ok, true);
  });

  test("an IPv4 address and the same address written as IPv6 are one network", async () => {
    let passed = 0;
    for (let i = 0; i < ANONYMOUS_FREE_PER_ADDRESS + 6; i++) {
      const from = i % 2 === 0 ? "203.0.113.50" : "::ffff:203.0.113.50";
      if ((await scanFrom(`v4-spelling-${i}`, from)).ok) passed++;
    }
    assert.equal(passed, ANONYMOUS_FREE_PER_ADDRESS);
  });
});

describe("the per-minute rate limit: an IPv6 /64 is one network too", () => {
  const hit = async (from: string) => (await fetch(`${base}/limited`, { headers: { "x-forwarded-for": from } })).status;

  test("hopping between addresses in one /64 does not dodge the limit", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push(await hit(`2001:db8:dddd:eeee:${(i + 1).toString(16)}::${(i + 9).toString(16)}`));
    assert.deepEqual(statuses.slice(0, 3), [200, 200, 200]);
    assert.deepEqual(statuses.slice(3), [429, 429, 429]);
  });

  test("another /64 is not held back by it", async () => {
    assert.equal(await hit("2001:db8:dddd:ffff::1"), 200);
  });
});
