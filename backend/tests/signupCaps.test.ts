import "./setupEnv";
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import type { AddressInfo } from "net";

// Signing in sends an email and every new account is a fresh set of free scans. Per email address there
// are already limits, but a script that makes up a new address each time gets round all of them; what it
// cannot make up is the network it connects from. So each network has a daily allowance of codes sent and
// of new accounts made (generous in real life; tiny here so the test can reach them).

const CODES_PER_NETWORK = 6;
const ACCOUNTS_PER_NETWORK = 2;

let base = "";
let server: http.Server;

before(async () => {
  process.env.AUTH_DEV_ECHO = "1"; // hand the code back in the reply (never in production)
  process.env.AUTH_RESEND_GAP_MS = "0"; // the 30-second gap between codes for one email would get in the way
  process.env.SIGNUP_CODES_PER_NETWORK_PER_DAY = String(CODES_PER_NETWORK);
  process.env.SIGNUP_ACCOUNTS_PER_NETWORK_PER_DAY = String(ACCOUNTS_PER_NETWORK);
  // After the settings above, so the auth module reads them.
  // (A default export arrives wrapped differently under the compiler's module settings than under tsx.)
  const authModule: any = await import("../routes/auth.js");
  const registerAuthRoutes: (app: express.Express) => void = authModule.default?.default ?? authModule.default;

  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  registerAuthRoutes(app);
  await new Promise<void>((ok) => {
    server = app.listen(0, "127.0.0.1", () => ok());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server?.closeAllConnections();
  server?.close();
});

const post = async (path: string, body: unknown, from: string) => {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": from },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
};
const askCode = (email: string, from: string) => post("/auth/request-code", { email }, from);
const verify = (email: string, code: string, from: string) => post("/auth/verify", { email, code, deviceId: `phone-${email}` }, from);

describe("sign-in codes: a daily allowance per network", () => {
  test("a network that has asked for its allowance is told to try tomorrow, and another network is not affected", async () => {
    const from = "198.51.100.10";
    for (let i = 0; i < CODES_PER_NETWORK; i++) {
      const r = await askCode(`codes-a-${i}@example.com`, from);
      assert.equal(r.body.ok, true, `code ${i + 1}`);
      assert.match(r.body.devCode, /^\d{6}$/);
    }
    const over = await askCode("codes-a-over@example.com", from);
    assert.equal(over.status, 429);
    assert.equal(over.body.error, "network-limit");
    assert.match(over.body.message, /tomorrow/);

    assert.equal((await askCode("codes-a-other@example.com", "198.51.100.11")).body.ok, true);
  });

  test("a request that sends nothing (one email asked for too often) does not use the allowance", async () => {
    const from = "198.51.100.20";
    // One email may have 5 codes an hour: five go out and use five of this network's six.
    for (let i = 0; i < 5; i++) assert.equal((await askCode("codes-b-same@example.com", from)).body.ok, true, `code ${i + 1}`);
    const refused = await askCode("codes-b-same@example.com", from);
    assert.equal(refused.body.error, "too-many"); // refused for that email: nothing was sent
    // Had that refusal been counted the network would be full now; it has one left.
    assert.equal((await askCode("codes-b-next@example.com", from)).body.ok, true);
    assert.equal((await askCode("codes-b-last@example.com", from)).body.error, "network-limit");
  });

  test("the allowance is per network: a /64 of IPv6 addresses is one network", async () => {
    for (let i = 0; i < CODES_PER_NETWORK; i++) {
      const r = await askCode(`codes-c-${i}@example.com`, `2001:db8:1:2:${(i + 1).toString(16)}::1`);
      assert.equal(r.body.ok, true, `code ${i + 1}`);
    }
    assert.equal((await askCode("codes-c-over@example.com", "2001:db8:1:2:ffff::9")).body.error, "network-limit");
  });
});

describe("new accounts: a daily allowance per network", () => {
  test("a network that has made its allowance of new accounts is turned away, and the code it brought is not used up", async () => {
    const busy = "198.51.100.30";
    const elsewhere = "198.51.100.31";
    const codes: Record<string, string> = {};
    for (const n of [1, 2, 3]) {
      // Codes come from different networks so the code allowance is not what is being tested.
      codes[n] = (await askCode(`acct-${n}@example.com`, `198.51.100.${60 + n}`)).body.devCode;
    }

    const first = await verify("acct-1@example.com", codes[1], busy);
    assert.equal(first.body.ok, true);
    assert.equal(first.body.isNew, true);
    assert.equal((await verify("acct-2@example.com", codes[2], busy)).body.isNew, true);

    const third = await verify("acct-3@example.com", codes[3], busy);
    assert.equal(third.status, 429);
    assert.equal(third.body.error, "network-limit");
    assert.match(third.body.message, /new accounts/);

    // The turned-away person's code was not used up: from another connection it still works.
    const retry = await verify("acct-3@example.com", codes[3], elsewhere);
    assert.equal(retry.body.ok, true);
    assert.equal(retry.body.isNew, true);
  });

  test("signing in to an account that already exists is never limited by it", async () => {
    const busy = "198.51.100.30"; // already at its allowance of new accounts from the test above
    const code = (await askCode("acct-1@example.com", "198.51.100.70")).body.devCode;
    const again = await verify("acct-1@example.com", code, busy);
    assert.equal(again.body.ok, true);
    assert.equal(again.body.isNew, false);
  });
});
