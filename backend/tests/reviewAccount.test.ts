import "./setupEnv";
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import http from "http";
import path from "path";
import express from "express";
import type { AddressInfo } from "net";
import registerAuthRoutes from "../routes/auth";
import { accountByEmail, accountForToken, deleteAccount } from "../utils/accountStore";
import { checkReviewCode, clearReviewAttemptsForTests, isEasyToGuess, reviewAccount, reviewAccountProblem } from "../utils/reviewAccount";
import { launchIssues } from "../utils/launchCheck";

// Google Play's reviewers cannot read an emailed code, so one address (REVIEW_ACCOUNT_EMAIL) signs in with a fixed six-digit code
// (REVIEW_ACCOUNT_CODE) and is never emailed. After sign-in it is an ordinary account. The sign-in routes are the real ones.

const EMAIL = "play-review@example.com";
const CODE = "482916";
const WRONG = "000001";
const MIN = 60_000;

const turnOn = (email = EMAIL, code = CODE) => {
  process.env.REVIEW_ACCOUNT_EMAIL = email;
  process.env.REVIEW_ACCOUNT_CODE = code;
};
const turnOff = () => {
  delete process.env.REVIEW_ACCOUNT_EMAIL;
  delete process.env.REVIEW_ACCOUNT_CODE;
};
const forgetReviewAccount = () => {
  const found = accountByEmail(EMAIL);
  if (found) deleteAccount(found.id);
};

let base = "";
let server: http.Server;
let nextHost = 0;
// Every request comes from its own pretend network unless a test needs two from the same one (the real per-address limits count them).
const newNetwork = () => `203.0.113.${++nextHost}`;

before(async () => {
  process.env.AUTH_DEV_ECHO = "1"; // an ordinary code is handed back in the reply, so a test can use one
  process.env.SIGNUP_CODES_PER_NETWORK_PER_DAY = "4";
  process.env.SIGNUP_ACCOUNTS_PER_NETWORK_PER_DAY = "1";
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
  turnOff();
});

beforeEach(() => {
  turnOn();
  clearReviewAttemptsForTests();
  forgetReviewAccount();
});

const post = async (route: string, body: unknown, from: string) => {
  const res = await fetch(`${base}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": from },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
};
const askCode = (email: string, from: string) => post("/auth/request-code", { email }, from);
const verify = (email: string, code: string, from: string, deviceId = `phone-${email}`) => post("/auth/verify", { email, code, deviceId }, from);

/** Everything the server prints while `run` goes on. */
async function withLogs(run: () => Promise<unknown>): Promise<string> {
  const lines: string[] = [];
  const originals = { log: console.log, warn: console.warn, error: console.error };
  for (const level of ["log", "warn", "error"] as const) console[level] = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
  try {
    await run();
  } finally {
    Object.assign(console, originals);
  }
  return lines.join("\n");
}

describe("off unless both settings are good", () => {
  test("with no settings the address is an ordinary one: a code is made, and the fixed code is useless", async () => {
    turnOff();
    const from = newNetwork();
    const asked = await askCode(EMAIL, from);
    assert.match(asked.body.devCode, /^\d{6}$/, "an ordinary code was made");
    const typed = asked.body.devCode === CODE ? "135792" : CODE;
    const attempt = await verify(EMAIL, typed, from);
    assert.equal(attempt.status, 400);
    assert.equal(attempt.body.error, "wrong-code");
    assert.equal(reviewAccountProblem(), null, "nothing is wrong: it is simply not set");
  });

  const unusable: Array<[string, string | undefined, string | undefined]> = [
    ["only the address is set", EMAIL, undefined],
    ["only the code is set", undefined, CODE],
    ["the address is not an email", "not-an-email", CODE],
    ["the code is five digits", EMAIL, "48291"],
    ["the code is seven digits", EMAIL, "4829163"],
    ["the code has a letter in it", EMAIL, "48291a"],
    ["the code is 123456", EMAIL, "123456"],
    ["the code is 111111", EMAIL, "111111"],
    ["the code is 654321", EMAIL, "654321"],
    ["the code is 121212", EMAIL, "121212"],
  ];
  unusable.forEach(([label, email, code], i) => {
    test(`${label}: it stays off, and a reason is given`, async () => {
      const address = `unusable-${i}@example.com`;
      turnOff();
      if (email !== undefined) process.env.REVIEW_ACCOUNT_EMAIL = email === EMAIL ? address : email;
      if (code !== undefined) process.env.REVIEW_ACCOUNT_CODE = code;
      assert.equal(reviewAccount(), null);
      const problem = reviewAccountProblem();
      assert.ok(problem, "a reason is given");
      assert.ok(!problem.includes(CODE) && !problem.includes("123456"), "and it never repeats a value");

      // In the routes the address is an ordinary one: a code is made for it, and the typed code does not sign anyone in.
      const from = newNetwork();
      const asked = await askCode(address, from);
      assert.match(asked.body.devCode, /^\d{6}$/);
      if (code !== undefined) {
        const typed = asked.body.devCode === code ? "135792" : code;
        assert.equal((await verify(address, typed, from)).status, 400);
      }
    });
  });

  test("it is read on every request, so deleting the settings switches it off at once", async () => {
    const address = "switched-off-review@example.com"; // its own address: the first test above has already asked for a code for EMAIL
    turnOn(address);
    assert.equal((await verify(address, CODE, newNetwork())).body.ok, true);
    turnOff();
    const from = newNetwork();
    assert.equal((await verify(address, CODE, from)).status, 400);
    assert.match((await askCode(address, from)).body.devCode, /^\d{6}$/, "an ordinary code, as for anyone");
  });
});

describe("on", () => {
  test("asking for a code sends nothing: no email, no code made, none of the network's allowance used", async () => {
    const address = "no-mail-review@example.com"; // its own address, so no earlier test has left a code for it in the file
    turnOn(address);
    const from = newNetwork();
    const replies: any[] = [];
    const printed = await withLogs(async () => {
      for (let i = 0; i < 5; i++) replies.push(await askCode(address, from)); // more than the 4 codes a network may ask for in a day
    });
    for (const r of replies) {
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { ok: true }, "the same reply as for anyone, with no code handed back");
    }
    assert.ok(!printed.includes("sign-in code"), "the development mailer printed no code");
    assert.ok(!printed.includes(address) && !printed.includes(CODE));
    const codesFile = path.join(process.env.DATA_DIR as string, "authCodes.json");
    assert.ok(!fs.existsSync(codesFile) || !fs.readFileSync(codesFile, "utf8").includes(address), "no code was kept for it");
    // The network has all 4 of its codes left for people who really are emailed.
    assert.match((await askCode("ordinary-allowance@example.com", from)).body.devCode, /^\d{6}$/);
  });

  test("the right code signs in, with no need to ask first, and it is an ordinary account", async () => {
    const first = await verify(EMAIL, CODE, newNetwork());
    assert.equal(first.status, 200);
    assert.deepEqual(Object.keys(first.body).sort(), ["deviceId", "email", "isNew", "ok", "token"], "the same reply as any sign-in");
    assert.equal(first.body.ok, true);
    assert.equal(first.body.isNew, true);
    assert.equal(first.body.email, EMAIL);
    assert.match(first.body.token, /^fp_/);
    const account = accountForToken(first.body.token);
    assert.equal(account?.email, EMAIL);
    assert.equal(account?.canonicalDeviceId, first.body.deviceId);

    // Signing in again, from another phone, is the same account.
    const second = await verify(EMAIL, CODE, newNetwork(), "another-phone-0001");
    assert.equal(second.body.isNew, false);
    assert.equal(second.body.deviceId, first.body.deviceId);
    assert.notEqual(second.body.token, first.body.token);
    assert.equal(accountForToken(second.body.token)?.id, account?.id);
  });

  test("the address is matched however it is typed", async () => {
    const from = newNetwork();
    const asked = await askCode("  Play-Review@EXAMPLE.com ", from);
    assert.deepEqual(asked.body, { ok: true });
    const signedIn = await verify("  Play-Review@EXAMPLE.com ", ` ${CODE} `, from);
    assert.equal(signedIn.body.ok, true);
    assert.equal(signedIn.body.email, EMAIL);
  });

  test("wrong codes are counted, five shut it, and then even the right code is refused", async () => {
    const from = newNetwork();
    const seen: Array<[number, string, number | undefined]> = [];
    for (let i = 0; i < 4; i++) {
      const r = await verify(EMAIL, WRONG, from);
      seen.push([r.status, r.body.error, r.body.attemptsLeft]);
    }
    assert.deepEqual(seen, [
      [400, "wrong-code", 4],
      [400, "wrong-code", 3],
      [400, "wrong-code", 2],
      [400, "wrong-code", 1],
    ]);
    const fifth = await verify(EMAIL, WRONG, from);
    assert.equal(fifth.status, 400);
    assert.equal(fifth.body.error, "code-locked");
    assert.match(fifth.body.message, /half an hour/, "a new code would not help them, so they are told to wait");
    const right = await verify(EMAIL, CODE, from);
    assert.equal(right.status, 400);
    assert.equal(right.body.error, "code-locked");
    assert.equal(accountByEmail(EMAIL), null, "nobody got in");

    // Other people are not affected.
    const other = newNetwork();
    const code = (await askCode("not-the-reviewer@example.com", other)).body.devCode;
    assert.equal((await verify("not-the-reviewer@example.com", code, other)).body.ok, true);
  });

  test("a right code clears the count", async () => {
    const from = newNetwork();
    for (let i = 0; i < 4; i++) await verify(EMAIL, WRONG, from);
    assert.equal((await verify(EMAIL, CODE, from)).body.ok, true);
    const again: Array<number | undefined> = [];
    for (let i = 0; i < 4; i++) again.push((await verify(EMAIL, WRONG, from)).body.attemptsLeft);
    assert.deepEqual(again, [4, 3, 2, 1], "counting starts again from the top, and it is not shut");
  });

  test("anyone else cannot use the fixed code, and their wrong tries do not count against the reviewers", async () => {
    const from = newNetwork();
    const other = "someone.else@example.com";
    const unasked = await verify(other, CODE, from);
    assert.equal(unasked.status, 400);

    const asked = await askCode(other, newNetwork());
    const typed = asked.body.devCode === CODE ? "135792" : CODE;
    const asAnother = await verify(other, typed, from);
    assert.equal(asAnother.status, 400);
    assert.equal(asAnother.body.error, "wrong-code");

    for (let i = 0; i < 4; i++) await verify(other, WRONG, from);
    assert.equal((await verify(EMAIL, CODE, newNetwork())).body.ok, true, "the reviewers are not shut out by somebody else's tries");
  });

  test("it is not counted as one of a network's sign-ups, and is not turned away when the network is full", async () => {
    const net = newNetwork(); // 1 new account a day for each network in this file
    assert.equal((await verify(EMAIL, CODE, net)).body.isNew, true);
    // The reviewers took none of the allowance, so an ordinary new person from the same network still gets theirs.
    const code = (await askCode("allowance-1@example.com", net)).body.devCode;
    const person = await verify("allowance-1@example.com", code, net);
    assert.equal(person.body.ok, true);
    assert.equal(person.body.isNew, true);
    // That person did use it: the limit is live.
    const code2 = (await askCode("allowance-2@example.com", net)).body.devCode;
    assert.equal((await verify("allowance-2@example.com", code2, net)).status, 429);

    // And a brand-new review account is not turned away by a network that is full.
    forgetReviewAccount();
    const again = await verify(EMAIL, CODE, net);
    assert.equal(again.body.ok, true);
    assert.equal(again.body.isNew, true);
  });

  test("the logs say a reviewer signed in or failed, and never the code or the address", async () => {
    const from = newNetwork();
    const printed = await withLogs(async () => {
      await verify(EMAIL, WRONG, from);
      await verify(EMAIL, CODE, from);
    });
    assert.match(printed, /\[review\] a wrong code was tried/);
    assert.match(printed, /\[review\] the review account signed in/);
    assert.ok(!printed.includes(CODE) && !printed.includes(EMAIL));
  });
});

describe("the wait, with the clock in our hands", () => {
  const t0 = Date.UTC(2026, 9, 23, 12, 0, 0);

  test("shut for half an hour after five wrong tries, then it opens", () => {
    for (let i = 0; i < 4; i++) assert.equal(checkReviewCode(WRONG, t0 + i * MIN).ok, false);
    assert.deepEqual(checkReviewCode(WRONG, t0 + 4 * MIN), { ok: false, reason: "locked" });
    assert.deepEqual(checkReviewCode(CODE, t0 + 33 * MIN), { ok: false, reason: "locked" }, "29 minutes later the right code is still refused");
    assert.deepEqual(checkReviewCode(CODE, t0 + 35 * MIN), { ok: true }, "31 minutes later it opens");
  });

  test("tries more than half an hour apart do not add up", () => {
    for (let i = 0; i < 4; i++) checkReviewCode(WRONG, t0);
    assert.deepEqual(checkReviewCode(WRONG, t0 + 31 * MIN), { ok: false, reason: "wrong", attemptsLeft: 4 });
  });

  test("a code that is not six digits is wrong, whatever it holds", () => {
    assert.equal(checkReviewCode(`${CODE}0`, t0).ok, false);
    assert.equal(checkReviewCode(Number(CODE), t0).ok, false);
    assert.equal(checkReviewCode(undefined, t0).ok, false);
  });
});

describe("codes that are easy to guess", () => {
  for (const code of ["000000", "111111", "123456", "234567", "654321", "543210", "890123", "901234", "121212", "123123", "789789", "112233", "445566"]) {
    test(`${code} is refused`, () => assert.equal(isEasyToGuess(code), true));
  }
  for (const code of ["482916", "907153", "318642", "725108"]) {
    test(`${code} is allowed`, () => assert.equal(isEasyToGuess(code), false));
  }
});

describe("the launch check", () => {
  const find = (env: Record<string, string>) => launchIssues({ NODE_ENV: "production", ...env }).find((i) => i.setting.includes("REVIEW_ACCOUNT"));

  test("reminds us to set it before Google Play, and says it is not worse than that", () => {
    const issue = find({});
    assert.equal(issue?.level, "should");
    assert.match(issue!.why, /Google Play/);
  });

  test("names the problem when a setting can't be used, without repeating a value", () => {
    const bad = find({ REVIEW_ACCOUNT_EMAIL: EMAIL, REVIEW_ACCOUNT_CODE: "123456" });
    assert.match(bad!.why, /too easy to guess/);
    assert.ok(!bad!.why.includes("123456") && !bad!.why.includes(EMAIL));
    assert.match(find({ REVIEW_ACCOUNT_EMAIL: EMAIL })!.why, /Only one of the two/);
  });

  test("says nothing when both are right", () => {
    assert.equal(find({ REVIEW_ACCOUNT_EMAIL: EMAIL, REVIEW_ACCOUNT_CODE: CODE }), undefined);
  });
});
