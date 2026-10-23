import "./setupEnv";
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import type { AddressInfo } from "net";
import registerPublishListingRoute from "../routes/publishListing";
import registerSellersRoute, { loadSellerStore } from "../routes/sellers";
import { accountGuard } from "../middleware/accountGuard";
import registerTradeSellerRoutes from "../routes/tradeSeller";
import { carFee } from "../utils/carListing";
import { cleanBusinessName, tradeSellerFor } from "../utils/tradeSeller";
import { deleteUserData, exportUserData } from "../utils/userData";
import { createSession, findOrCreateAccount } from "../utils/accountStore";
import { loadListings, saveListings } from "../routes/publishedListings";
import { POLICY } from "../config/marketplacePolicy";

// Trade sellers (22 Oct 2026): a dealer lists cars in the app without Dealer OS. They say so (a business name, shown to buyers as
// "Trade seller"), may have several cars up at once where a private seller has one, and list free while we launch.
// The listing routes are the real ones; the database is a throwaway folder.

delete process.env.DVLA_API_KEY; // no real DVLA call: cars need no registration in a test
delete process.env.SELLING_ALLOWED_DEVICE_IDS;
delete process.env.MARKETPLACE_PROMO_ENDS_AT; // the launch offer is running unless a test says otherwise
delete process.env.TRADE_LISTINGS_FREE;
const ADMIN = { "x-admin-token": process.env.ADMIN_TOKEN as string };

let base = "";
let server: http.Server;

before(async () => {
  const app = express();
  // Each phone below has its own pretend network address (see call), so the real per-address rate limits don't stop a test that makes many listings.
  app.set("trust proxy", true);
  app.use(express.json());
  // Stands in for the real sign-in: x-test-account says who is signed in, and x-device-id is that account's own phone id.
  app.use((req: any, _res, next) => {
    const acc = req.headers["x-test-account"];
    if (typeof acc === "string") req.account = { id: acc, canonicalDeviceId: String(req.headers["x-device-id"] ?? "") };
    next();
  });
  registerPublishListingRoute(app);
  registerSellersRoute(app);
  registerTradeSellerRoutes(app);
  await new Promise<void>((ok) => {
    server = app.listen(0, "127.0.0.1", () => ok());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server?.closeAllConnections();
  server?.close();
});

beforeEach(() => {
  process.env.TRADE_MAX_CARS = "3"; // small, so the limit is quick to reach
  delete process.env.MARKETPLACE_PROMO_ENDS_AT;
  delete process.env.TRADE_LISTINGS_FREE;
});

const addresses = new Map<string, string>();
const addressOf = (who: string) => {
  if (!addresses.has(who)) addresses.set(who, `10.7.${Math.floor(addresses.size / 250)}.${(addresses.size % 250) + 1}`);
  return addresses.get(who)!;
};

async function call(method: "GET" | "POST", path: string, who?: string, body?: unknown, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": addressOf(who ?? "nobody"), ...extra };
  if (who) {
    headers["x-test-account"] = `acct-${who}`;
    headers["x-device-id"] = who;
  }
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => null)) as any };
}

const car = (who: string, extra: Record<string, unknown> = {}) =>
  call("POST", "/create-listing", who, { deviceId: who, title: "Ford Focus 1.6", price: 4500, category: "motors", description: "A good car", ...extra });
const item = (who: string) => call("POST", "/create-listing", who, { deviceId: who, title: "A kettle", price: 10, category: "home" });
const becomeTrade = (who: string, businessName = "Test Motors") => call("POST", "/trade-seller", who, { deviceId: who, businessName });

describe("a private seller", () => {
  test("has one car at a time, and is told dealers can have more", async () => {
    assert.equal((await car("private-1")).json.ok, true);
    const second = await car("private-1");
    assert.equal(second.status, 409);
    assert.equal(second.json.error, "car-limit");
    assert.equal(second.json.tradeAvailable, true, "the app offers the dealer sign-up");
    assert.match(second.json.message, /dealer/i);
    assert.match(second.json.message, /3 cars/, "it names how many a trade seller may have");
  });

  test("cannot make a listing a trade one by saying so", async () => {
    const r = await car("private-2", { tradeSeller: true, trade: true });
    assert.equal(r.json.ok, true);
    assert.equal(r.json.listing.tradeSeller, undefined);
  });
});

describe("saying you trade", () => {
  test("a business name must be a name: no contact details, a sensible length", () => {
    for (const bad of ["", " ", "A", "x".repeat(61), "!!!", "see www.cheapcars.co.uk", "cars.com", "mail me@cars.co.uk", "call 07700 900123 now", "https://cars", 42, null, undefined]) {
      assert.equal(cleanBusinessName(bad).ok, false, `refused: ${String(bad)}`);
    }
    for (const good of ["A1 Autos", "Smith & Sons Ltd.", "J.K. Motors", "  Bob's   Cars  "]) {
      assert.equal(cleanBusinessName(good).ok, true, `accepted: ${good}`);
    }
    assert.deepEqual(cleanBusinessName("  Bob's   Cars  "), { ok: true, name: "Bob's Cars" });
  });

  test("a refused name says why and changes nothing", async () => {
    const r = await becomeTrade("name-1", "call 07700 900123");
    assert.equal(r.status, 400);
    assert.equal(r.json.error, "bad-business-name");
    assert.match(r.json.message, /phone number/);
    assert.equal(tradeSellerFor("name-1"), null);
  });

  test("works for a dealer who has never listed anything, shows the rules, and can change the name later", async () => {
    const r = await becomeTrade("name-2", "Dave's Cars");
    assert.equal(r.json.ok, true);
    assert.equal(r.json.tradeSeller.businessName, "Dave's Cars");
    assert.equal(r.json.carLimit, 3);
    assert.equal(r.json.free, true);
    const since = r.json.tradeSeller.since;

    const status = await call("GET", "/trade-seller?deviceId=name-2", "name-2");
    assert.equal(status.json.tradeSeller.businessName, "Dave's Cars");

    const renamed = await becomeTrade("name-2", "Dave's Quality Cars");
    assert.equal(renamed.json.tradeSeller.businessName, "Dave's Quality Cars");
    assert.equal(renamed.json.tradeSeller.since, since, "changing the name keeps the date they started");
  });

  test("a phone that is not one is told so", async () => {
    const r = await call("GET", "/trade-seller?deviceId=never-registered");
    assert.equal(r.json.ok, true);
    assert.equal(r.json.tradeSeller, null);
  });

  test("a request with no phone id is refused", async () => {
    assert.equal((await call("GET", "/trade-seller")).status, 400);
    assert.equal((await call("POST", "/trade-seller", undefined, { businessName: "No Phone Motors" })).status, 400);
  });

  test("the rules the sell screen reads include the dealers'", async () => {
    const p = (await call("GET", "/marketplace/policy")).json;
    assert.equal(p.tradeCarLimit, 3);
    assert.equal(p.tradeFree, true);
    assert.equal(p.maxActiveCars, 1, "a private seller's limit is unchanged");
  });
});

describe("a trade seller", () => {
  test("has several cars up at once, up to the limit, each marked as a trade car", async () => {
    await becomeTrade("trade-1", "Trade One Motors");
    for (let i = 1; i <= 3; i++) {
      const r = await car("trade-1");
      assert.equal(r.json.ok, true, `car ${i}`);
      assert.equal(r.json.listing.tradeSeller, true, `car ${i} says so on its card`);
    }
    const fourth = await car("trade-1");
    assert.equal(fourth.status, 409);
    assert.equal(fourth.json.error, "car-limit");
    assert.match(fourth.json.message, /3 cars/);
    assert.equal(fourth.json.tradeAvailable, undefined, "they are already one");
  });

  test("everyday items are listed as before, also marked", async () => {
    await becomeTrade("trade-2");
    const r = await item("trade-2");
    assert.equal(r.json.ok, true);
    assert.equal(r.json.listing.tradeSeller, true);
  });

  test("buyers see Trade seller and the name on the seller's page", async () => {
    await becomeTrade("trade-3", "Third Motors");
    const listing = (await car("trade-3")).json.listing;
    const profile = (await call("GET", `/sellers/${listing.sellerId}`)).json.seller;
    assert.equal(profile.trade, true);
    assert.equal(profile.tradeName, "Third Motors");
    const priv = (await car("private-3")).json.listing;
    const privateProfile = (await call("GET", `/sellers/${priv.sellerId}`)).json.seller;
    assert.equal(privateProfile.trade, undefined);
    assert.equal(privateProfile.tradeName, undefined);
  });

  test("cars already listed become trade cars when the seller signs up, and plain ones again if it is taken away", async () => {
    const before = (await car("trade-4")).json.listing;
    assert.equal(before.tradeSeller, undefined);
    await becomeTrade("trade-4");
    const mine = (await call("GET", "/my-listings?deviceId=trade-4", "trade-4")).json as any[];
    assert.equal(mine.find((l) => l.id === before.id)?.tradeSeller, true);

    // Taking it away needs the admin token, and names the seller by their public id (a phone id would be turned away by the real sign-in guard).
    assert.ok((await call("POST", "/admin/trade-seller/revoke", undefined, { sellerId: before.sellerId })).status >= 400);
    assert.equal(tradeSellerFor("trade-4")?.businessName, "Test Motors");

    const revoked = await call("POST", "/admin/trade-seller/revoke", undefined, { sellerId: before.sellerId }, ADMIN);
    assert.equal(revoked.json.revoked, true);
    assert.equal(tradeSellerFor("trade-4"), null);
    const after = (await call("GET", "/my-listings?deviceId=trade-4", "trade-4")).json as any[];
    assert.equal(after.find((l) => l.id === before.id)?.tradeSeller, undefined);
    assert.equal((await call("POST", "/admin/trade-seller/revoke", undefined, { sellerId: before.sellerId }, ADMIN)).json.revoked, false, "nothing left to take away");
    assert.equal((await call("POST", "/admin/trade-seller/revoke", undefined, { sellerId: "no-such-seller" }, ADMIN)).status, 404);
  });

  test("once it is taken away they are back to one car at a time", async () => {
    await becomeTrade("trade-5");
    const first = (await car("trade-5")).json.listing;
    assert.equal((await car("trade-5")).json.ok, true);
    await call("POST", "/admin/trade-seller/revoke", undefined, { sellerId: first.sellerId }, ADMIN);
    assert.equal((await car("trade-5")).json.error, "car-limit", "two are already up, and a private seller may have one");
  });

  test("an admin can also take it away by the account's email", async () => {
    const account = findOrCreateAccount("dealer-email@example.com", "trade-7").account;
    await becomeTrade(account.canonicalDeviceId, "Email Motors");
    assert.equal(tradeSellerFor(account.canonicalDeviceId)?.businessName, "Email Motors");
    assert.equal((await call("POST", "/admin/trade-seller/revoke", undefined, { email: "nobody-at-all@example.com" }, ADMIN)).status, 404);
    assert.equal((await call("POST", "/admin/trade-seller/revoke", undefined, { email: "dealer-email@example.com" }, ADMIN)).json.revoked, true);
    assert.equal(tradeSellerFor(account.canonicalDeviceId), null);
  });

  test("their record goes with the rest of their data when they delete it, and is in their export", async () => {
    await becomeTrade("trade-6", "Export Motors");
    await car("trade-6");
    assert.equal((exportUserData("trade-6") as any).sellerProfile.tradeSeller.businessName, "Export Motors");
    deleteUserData("trade-6");
    assert.equal(tradeSellerFor("trade-6"), null);
    assert.equal((await call("GET", "/trade-seller?deviceId=trade-6")).json.tradeSeller, null);
  });
});

describe("after the launch offer", () => {
  beforeEach(() => {
    process.env.MARKETPLACE_PROMO_ENDS_AT = "2020-01-01"; // long gone
  });

  test("a private seller with no credits cannot list a car, a trade seller can (free while we launch)", async () => {
    const priv = await car("after-private");
    assert.equal(priv.status, 402);
    assert.equal(priv.json.error, "credits-required");

    await becomeTrade("after-trade");
    for (let i = 1; i <= 3; i++) assert.equal((await car("after-trade")).json.ok, true, `car ${i}`);
    assert.equal((await car("after-trade")).json.error, "car-limit");
  });

  test("what a car costs: nothing for a trade seller while we launch, credits for everyone else", async () => {
    await becomeTrade("fee-trade");
    assert.equal(carFee("fee-trade"), 0);
    assert.equal(carFee("fee-private"), POLICY.carCreditCost);
  });

  test("when the free period ends, a trade seller pays credits like anyone (and still has the higher limit)", async () => {
    await becomeTrade("paying-trade");
    process.env.TRADE_LISTINGS_FREE = "off";
    assert.equal(carFee("paying-trade"), POLICY.carCreditCost);
    const r = await car("paying-trade");
    assert.equal(r.status, 402);
    assert.equal(r.json.error, "credits-required");
  });

  test("the rules for everyday items do not change for a trade seller", async () => {
    await becomeTrade("items-trade");
    for (let i = 1; i <= 5; i++) assert.equal((await item("items-trade")).json.ok, true, `item ${i}`);
    assert.equal((await item("items-trade")).json.error, "credits-required");
  });
});

describe("under the real sign-in guard", () => {
  // The guard keeps an account's phone id for the account: a request that names it must carry that account's token. That is why an
  // admin names a seller by public id or email. (Found by running the routes for real: the first version named the phone id.)
  let guarded: http.Server;
  let gbase = "";
  before(async () => {
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.use(accountGuard);
    registerSellersRoute(app);
    registerTradeSellerRoutes(app);
    await new Promise<void>((ok) => {
      guarded = app.listen(0, "127.0.0.1", () => ok());
    });
    gbase = `http://127.0.0.1:${(guarded.address() as AddressInfo).port}`;
  });
  after(() => {
    guarded?.closeAllConnections();
    guarded?.close();
  });

  test("a dealer signs up with their own token; an admin takes it away by seller id, and naming the phone id is turned away", async () => {
    const { account } = findOrCreateAccount("guarded@example.com", "guarded-phone");
    const token = createSession(account.id);
    const json = { "content-type": "application/json" };
    const reg = await fetch(gbase + "/trade-seller", {
      method: "POST",
      headers: { ...json, authorization: `Bearer ${token}`, "x-forwarded-for": "10.9.0.1" },
      body: JSON.stringify({ deviceId: account.canonicalDeviceId, businessName: "Guarded Motors" }),
    });
    assert.equal(((await reg.json()) as any).ok, true);

    const byPhone = await fetch(gbase + "/admin/trade-seller/revoke", {
      method: "POST",
      headers: { ...json, ...ADMIN, "x-forwarded-for": "10.9.0.2" },
      body: JSON.stringify({ deviceId: account.canonicalDeviceId }),
    });
    assert.equal(byPhone.status, 401, "the guard keeps the phone id for its owner");
    assert.equal(tradeSellerFor(account.canonicalDeviceId)?.businessName, "Guarded Motors");

    const sellerId = loadSellerStore().sellers.find((s) => s.deviceId === account.canonicalDeviceId)!.id;
    const bySeller = await fetch(gbase + "/admin/trade-seller/revoke", {
      method: "POST",
      headers: { ...json, ...ADMIN, "x-forwarded-for": "10.9.0.3" },
      body: JSON.stringify({ sellerId }),
    });
    assert.equal(((await bySeller.json()) as any).revoked, true);
    assert.equal(tradeSellerFor(account.canonicalDeviceId), null);
  });

  test("somebody else's token cannot make a phone a trade seller", async () => {
    const mine = findOrCreateAccount("guarded-owner@example.com", "guarded-owner-phone").account;
    const other = findOrCreateAccount("guarded-other@example.com", "guarded-other-phone").account;
    const res = await fetch(gbase + "/trade-seller", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${createSession(other.id)}`, "x-forwarded-for": "10.9.0.4" },
      body: JSON.stringify({ deviceId: mine.canonicalDeviceId, businessName: "Not Mine Motors" }),
    });
    assert.equal(res.status, 401);
    assert.equal(tradeSellerFor(mine.canonicalDeviceId), null);
  });
});

describe("the limit is a setting", () => {
  test("TRADE_MAX_CARS changes it, and a nonsense value falls back to 15", async () => {
    const { tradeCarLimit } = await import("../config/marketplacePolicy.js");
    process.env.TRADE_MAX_CARS = "7";
    assert.equal(tradeCarLimit(), 7);
    for (const bad of ["", "0", "-2", "lots"]) {
      process.env.TRADE_MAX_CARS = bad;
      assert.equal(tradeCarLimit(), 15, `"${bad}"`);
    }
    delete process.env.TRADE_MAX_CARS;
    assert.equal(tradeCarLimit(), 15);
  });
});

// Leaves nothing in the throwaway folder that another test file could trip over.
after(() => saveListings(loadListings().filter(() => false)));
