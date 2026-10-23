import "./setupEnv";
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import registerMeRoute from "../routes/me";
import registerAuthRoutes from "../routes/auth";
import { accountGuard } from "../middleware/accountGuard";
import { accountByEmail, accountForToken, createSession, findOrCreateAccount, normaliseEmail } from "../utils/accountStore";
import { creditsFor, grant } from "../utils/creditStore";
import { loadListings, saveListings } from "../routes/publishedListings";
import { loadSellerStore, saveSellerStore } from "../routes/sellers";
import { loadFairs, saveFairs } from "../routes/fairs";

// Someone who can't use the app (lost phone, uninstalled) emails us. The person who runs FlipPilot can then
// do what the app's "Download my data" and "Delete my account" do, by the email address on the account.
// These tests hold that to the same result as the app's own buttons, and to nobody else's data.

let server: http.Server;
let base = "";
const ADMIN = { "x-admin-token": process.env.ADMIN_TOKEN! };

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(accountGuard);
  registerAuthRoutes(app);
  registerMeRoute(app);
  await new Promise<void>((ok) => {
    server = app.listen(0, "127.0.0.1", () => ok());
  });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(() => {
  server?.close();
});

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as any };
}

/** An account with a listing (and a buyer's message on it), a seller profile, a boot fair and some credits. */
function seed(email: string) {
  // Signing in always stores the tidied, lower-case address (routes/auth.ts normalises it first), so do the same here.
  const { account } = findOrCreateAccount(normaliseEmail(email)!, undefined);
  const dev = account.canonicalDeviceId;
  const now = new Date().toISOString();
  saveListings([
    ...loadListings(),
    {
      id: `L-${dev.slice(0, 8)}`,
      deviceId: dev,
      title: "Mountain bike",
      price: 120,
      photos: [],
      createdAt: now,
      messages: [{ threadId: "t1", author: "buyer", deviceId: "some-buyer", message: "Is it still for sale?", timestamp: now }],
    } as any,
  ]);
  const store = loadSellerStore();
  store.sellers.push({ id: `S-${dev.slice(0, 8)}`, deviceId: dev, joinedAt: now, displayName: "Bike Bob" } as any);
  saveSellerStore(store);
  saveFairs([...loadFairs(), { id: `F-${dev.slice(0, 8)}`, ownerDeviceId: dev, title: "Sunday market", images: [], date: now }]);
  grant(account.id, 100, "gift");
  return { account, dev, token: createSession(account.id) };
}

const ownListings = (dev: string) => loadListings().filter((l: any) => l.deviceId === dev).length;
const ownFairs = (dev: string) => loadFairs().filter((f: any) => f.ownerDeviceId === dev).length;
const ownSellers = (dev: string) => loadSellerStore().sellers.filter((s: any) => s.deviceId === dev).length;

describe("the person who runs FlipPilot, asked by email", () => {
  test("both routes are closed without the admin token", async () => {
    const who = seed("closed-door@example.com");
    const wrongTokens: Record<string, string>[] = [{}, { "x-admin-token": "not-the-token" }];
    for (const headers of wrongTokens) {
      assert.equal((await call("GET", `/admin/account-export?email=${who.account.email}`, undefined, headers)).status, 401);
      assert.equal((await call("POST", "/admin/delete-account", { email: who.account.email, confirm: "DELETE" }, headers)).status, 401);
    }
    assert.ok(accountByEmail(who.account.email), "the account must still be there");
    assert.equal(ownListings(who.dev), 1);
  });

  test("a copy of what is held, found by the email address (in any case)", async () => {
    const who = seed("Copy.Me@Example.com");
    const r = await call("GET", "/admin/account-export?email=COPY.me@example.COM", undefined, ADMIN);
    assert.equal(r.status, 200);
    const d = r.data.data;
    assert.equal(d.account.email, "copy.me@example.com");
    assert.ok(d.account.createdAt && d.account.lastLoginAt, "the account's dates are in the copy");
    assert.equal(d.deviceId, who.dev);
    assert.equal(d.listings.length, 1, "the listing is in the copy");
    assert.equal(d.listings[0].title, "Mountain bike");
    assert.equal(d.sellerProfile.displayName, "Bike Bob");
    assert.equal(d.bootFairs.length, 1);
    assert.equal(d.scanCredits.balance, 100);
  });

  test("no account with that address is a 404, and a missing address is too", async () => {
    assert.equal((await call("GET", "/admin/account-export?email=nobody-here@example.com", undefined, ADMIN)).status, 404);
    assert.equal((await call("GET", "/admin/account-export", undefined, ADMIN)).status, 404);
    assert.equal((await call("POST", "/admin/delete-account", { email: "nobody-here@example.com", confirm: "DELETE" }, ADMIN)).status, 404);
  });

  test("it matches the app's own Download my data, and the app's copy now carries the account itself", async () => {
    const who = seed("same-copy@example.com");
    const byEmail = (await call("GET", `/admin/account-export?email=${who.account.email}`, undefined, ADMIN)).data.data;
    const inApp = await call("GET", "/me/export", undefined, { authorization: `Bearer ${who.token}`, "x-device-id": who.dev });
    assert.equal(inApp.status, 200);
    const a = { ...inApp.data.data, generatedAt: "x" };
    const b = { ...byEmail, generatedAt: "x" };
    assert.deepEqual(a, b, "the two copies differ");
    assert.equal(a.account.email, "same-copy@example.com");
  });

  test("deleting needs the word DELETE, as the app's own button does", async () => {
    const who = seed("careful@example.com");
    for (const confirm of [undefined, "", "yes", "delete"]) {
      const r = await call("POST", "/admin/delete-account", { email: who.account.email, ...(confirm === undefined ? {} : { confirm }) }, ADMIN);
      assert.equal(r.status, 400, `confirm=${confirm}`);
    }
    assert.ok(accountByEmail(who.account.email), "nothing was deleted");
    assert.equal(ownListings(who.dev), 1);
  });

  test("deleting removes the account and everything under it, and signs it out", async () => {
    const who = seed("gone@example.com");
    assert.ok(accountForToken(who.token), "signed in before");
    const r = await call("POST", "/admin/delete-account", { email: "Gone@Example.com", confirm: "DELETE" }, ADMIN);
    assert.equal(r.status, 200);
    assert.equal(r.data.removed.listingsRemoved, 1);
    assert.equal(r.data.removed.fairsRemoved, 1);
    assert.equal(r.data.removed.sellerProfileRemoved, true);
    assert.equal(r.data.removed.messagesRemoved, 1);
    assert.equal(accountByEmail(who.account.email), null, "the account is gone");
    assert.equal(accountForToken(who.token), null, "its sign-in no longer works");
    assert.equal(creditsFor(who.account.id), null, "its credits are gone");
    assert.equal(ownListings(who.dev), 0);
    assert.equal(ownFairs(who.dev), 0);
    assert.equal(ownSellers(who.dev), 0);
    // asking again finds nothing
    assert.equal((await call("POST", "/admin/delete-account", { email: who.account.email, confirm: "DELETE" }, ADMIN)).status, 404);
  });

  test("deleting one person leaves everybody else exactly as they were", async () => {
    const leaving = seed("leaving@example.com");
    const staying = seed("staying@example.com");
    await call("POST", "/admin/delete-account", { email: leaving.account.email, confirm: "DELETE" }, ADMIN);
    assert.ok(accountByEmail(staying.account.email), "the other account is still there");
    assert.ok(accountForToken(staying.token), "and still signed in");
    assert.equal(creditsFor(staying.account.id)?.balance, 100);
    assert.equal(ownListings(staying.dev), 1);
    assert.equal(ownFairs(staying.dev), 1);
    assert.equal(ownSellers(staying.dev), 1);
  });

  test("it ends in the same place as the app's own Delete my account", async () => {
    const byApp = seed("via-app@example.com");
    const byEmail = seed("via-email@example.com");
    const app = await call("POST", "/auth/delete-account", { confirm: "DELETE" }, { authorization: `Bearer ${byApp.token}`, "x-device-id": byApp.dev });
    const admin = await call("POST", "/admin/delete-account", { email: byEmail.account.email, confirm: "DELETE" }, ADMIN);
    assert.equal(app.status, 200);
    assert.equal(admin.status, 200);
    assert.deepEqual(admin.data.removed, app.data.removed, "the two ways remove different things");
    for (const who of [byApp, byEmail]) {
      assert.equal(accountByEmail(who.account.email), null);
      assert.equal(accountForToken(who.token), null);
      assert.equal(creditsFor(who.account.id), null);
      assert.equal(ownListings(who.dev) + ownFairs(who.dev) + ownSellers(who.dev), 0);
    }
  });
});
