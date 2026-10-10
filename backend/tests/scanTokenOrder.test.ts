import "./setupEnv";
process.env.FREE_SCAN_CAP = "on";
process.env.DAILY_LOOKUP_LIMIT = "3";

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import type { AddressInfo } from "net";
import { requireScanToken, spendScanToken } from "../middleware/requireScanToken";
import { paidLookupBudget } from "../middleware/dailyBudget";
import { issueScanToken, checkScanToken, SCAN_TOKEN_MAX_USES } from "../utils/scanToken";

// Found by review 2026-10-09: /price ran the server-wide daily lookup budget BEFORE checking the scan
// token, so requests with no valid token (30 a minute from one address) used up the whole day's budget
// and turned every paid route into "busy". The token is now looked at first, the budget second, and the
// token use is only counted once the budget has let the request through.

let base = "";
let server: http.Server;
let ran = 0;

before(async () => {
  const app = express();
  app.use(express.json());
  app.post("/price", requireScanToken, paidLookupBudget, spendScanToken, (_req, res) => {
    ran++;
    res.json({ ok: true });
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

const price = async (body: Record<string, unknown>) => {
  const res = await fetch(`${base}/price`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as any };
};

describe("token first, then the daily budget, then the token use", () => {
  test("requests with no valid token never touch the daily budget", async () => {
    // The limit is 3: if each of these used one, the real request below would be told "busy".
    for (let i = 0; i < 20; i++) {
      const r = await price({ deviceId: "order-phone", title: "Thing" });
      assert.equal(r.body.error, "scan-required");
    }
    for (let i = 0; i < 5; i++) {
      const r = await price({ deviceId: "order-phone", title: "Thing", scanToken: "not.atoken" });
      assert.equal(r.body.error, "scan-required");
    }
    const token = issueScanToken("order-phone");
    const ok = await price({ deviceId: "order-phone", title: "Thing", scanToken: token });
    assert.equal(ok.body.ok, true);
    assert.equal(ran, 1);
  });

  test("a request the budget refuses does not cost the customer one of their rechecks", async () => {
    const token = issueScanToken("order-phone-2");
    // The day's budget is 3 and one is already used above: these two use the other two.
    assert.equal((await price({ deviceId: "order-phone-2", title: "Thing", scanToken: token })).body.ok, true);
    assert.equal((await price({ deviceId: "order-phone-2", title: "Thing", scanToken: token })).body.ok, true);
    assert.deepEqual(checkScanToken(token, "order-phone-2", Date.now(), "Thing"), { ok: true, usesLeft: SCAN_TOKEN_MAX_USES - 2 });

    const refused = await price({ deviceId: "order-phone-2", title: "Thing", scanToken: token });
    assert.equal(refused.status, 503);
    assert.equal(refused.body.error, "busy");
    // And the refused request left the token exactly as it was.
    assert.deepEqual(checkScanToken(token, "order-phone-2", Date.now(), "Thing"), { ok: true, usesLeft: SCAN_TOKEN_MAX_USES - 2 });
  });
});

describe("the real /price route is wired in that order", () => {
  test("requireScanToken, then paidLookupBudget, then spendScanToken", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(path.join(__dirname, "..", "routes", "scanSteps.ts"), "utf8");
    assert.match(source, /router\.post\("\/price",\s*rateLimit\(\d+\),\s*requireScanToken,\s*paidLookupBudget,\s*spendScanToken,/);
  });
});
