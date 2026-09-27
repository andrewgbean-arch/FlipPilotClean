import "./setupEnv";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import helmet from "helmet";
import registerGamesRoute from "../routes/games";
import { accountGuard } from "../middleware/accountGuard";
import { createSession, findOrCreateAccount } from "../utils/accountStore";
import { getBalance, grant } from "../utils/creditStore";
import { progressFor, UNLOCK_CREDITS, UNLOCK_DAYS } from "../utils/nightglassStore";

// Operation Nightglass chapter downloads: the files the app fetches, and nothing else.

let server: http.Server;
let base = "";

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(accountGuard);
  registerGamesRoute(app);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(() => server.close());

test("serves a chapter page with its size and a long cache", async () => {
  const res = await fetch(`${base}/games/nightglass/chapter2.html?v=1`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  assert.match(res.headers.get("cache-control") ?? "", /max-age=604800/);
  assert.ok(Number(res.headers.get("content-length")) > 1_000_000, "a whole chapter, with a length for the progress bar");
  const page = await res.text();
  assert.match(page, /CHAPTER|Nightglass/);
});

test("a chapter page may run its own inline code, and be shown inside the web app", async () => {
  const app = express();
  app.use(helmet());
  registerGamesRoute(app);
  const s = app.listen(0);
  await new Promise((r) => s.once("listening", r));
  try {
    const res = await fetch(`http://127.0.0.1:${(s.address() as { port: number }).port}/games/nightglass/chapter2.html?v=1`);
    assert.equal(res.status, 200);
    const csp = res.headers.get("content-security-policy") ?? "";
    assert.match(csp, /script-src 'unsafe-inline'/, "the whole game is one inline script");
    assert.match(csp, /frame-ancestors \*/);
    assert.equal(res.headers.get("x-frame-options"), null);
    await res.arrayBuffer();
  } finally {
    s.close();
  }
});

test("anything that is not a chapter page is not found", async () => {
  for (const p of ["chapter99.html", "chapter2.htm", "..%2F..%2Fserver.ts", "notes.txt", "chapter2.html.bak"]) {
    const res = await fetch(`${base}/games/nightglass/${p}`);
    assert.equal(res.status, 404, p);
  }
});

// ---- a player's place in the season ---------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
function signIn(email: string): { token: string; id: string } {
  const { account } = findOrCreateAccount(email, undefined);
  return { token: createSession(account.id), id: account.id };
}
async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

test("signed out, the season has no progress and nothing can be unlocked", async () => {
  const p = await call("GET", "/games/nightglass/progress");
  assert.equal(p.status, 200);
  assert.equal(p.data.signedIn, false);
  const u = await call("POST", "/games/nightglass/unlock", undefined, { chapter: 2 });
  assert.equal(u.status, 401);
  assert.equal(u.data.error, "sign-in-required");
});

test("a new player has Chapter One, and Chapter Two comes 28 days later", async () => {
  const { token } = signIn(`ng-new-${Date.now()}@example.com`);
  const before = Date.now();
  const p = await call("GET", "/games/nightglass/progress", token);
  assert.equal(p.status, 200);
  assert.deepEqual(p.data.unlocked, [1]);
  assert.equal(p.data.next.chapter, 2);
  const due = Date.parse(p.data.next.unlocksAt);
  assert.ok(Math.abs(due - (before + UNLOCK_DAYS * DAY_MS)) < 60_000, "four weeks from the first visit");
  assert.equal(p.data.unlockCredits, UNLOCK_CREDITS);
});

test("waiting unlocks a chapter every 28 days, dated to the day it fell due", () => {
  const { id } = signIn(`ng-wait-${Date.now()}@example.com`);
  const start = new Date("2026-01-01T09:00:00Z");
  assert.deepEqual(progressFor(id, start).unlocked, [1]);
  assert.deepEqual(progressFor(id, new Date(start.getTime() + 27 * DAY_MS)).unlocked, [1]);
  const later = progressFor(id, new Date(start.getTime() + 60 * DAY_MS));
  assert.deepEqual(later.unlocked, [1, 2, 3]);
  assert.equal(later.next?.chapter, 4);
  assert.equal(later.next?.unlocksAt, new Date(start.getTime() + 3 * UNLOCK_DAYS * DAY_MS).toISOString());
});

test("the next chapter can be unlocked at once for credits, and the one after follows 28 days later", async () => {
  const { token, id } = signIn(`ng-pay-${Date.now()}@example.com`);
  const broke = await call("POST", "/games/nightglass/unlock", token, { chapter: 2 });
  assert.equal(broke.status, 402);
  assert.equal(broke.data.error, "credits-required");
  assert.equal(broke.data.needed, UNLOCK_CREDITS);

  grant(id, 30, "gift", `ng-test-${id}`);
  const paid = await call("POST", "/games/nightglass/unlock", token, { chapter: 2 });
  assert.equal(paid.status, 200);
  assert.equal(paid.data.charged, UNLOCK_CREDITS);
  assert.deepEqual(paid.data.unlocked, [1, 2]);
  assert.equal(paid.data.next.chapter, 3);
  assert.ok(Date.parse(paid.data.next.unlocksAt) > Date.now() + (UNLOCK_DAYS - 1) * DAY_MS);
  assert.equal(getBalance(id), 5);

  // Unlocking it again is free, and chapters can't be bought out of order.
  const again = await call("POST", "/games/nightglass/unlock", token, { chapter: 2 });
  assert.equal(again.status, 200);
  assert.equal(again.data.charged, 0);
  const skip = await call("POST", "/games/nightglass/unlock", token, { chapter: 4 });
  assert.equal(skip.status, 409);
  assert.equal(skip.data.error, "unlock-in-order");
  assert.equal(getBalance(id), 5);
});

test("a chapter that isn't out yet can't be bought", async () => {
  const { token, id } = signIn(`ng-early-${Date.now()}@example.com`);
  grant(id, 100, "gift", `ng-early-${id}`);
  for (const chapter of [1, 11, 13, "two"]) {
    const r = await call("POST", "/games/nightglass/unlock", token, { chapter });
    assert.equal(r.status, 404, String(chapter));
  }
  assert.equal(getBalance(id), 100);
});
