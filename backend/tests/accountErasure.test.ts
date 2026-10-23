import "./setupEnv";
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import http from "http";
import path from "path";
import express from "express";
import registerMeRoute from "../routes/me";
import registerAuthRoutes from "../routes/auth";
import { accountGuard } from "../middleware/accountGuard";
import { accountByEmail, accountForToken, createSession, findOrCreateAccount, inactiveAccounts } from "../utils/accountStore";
import { eraseAccount, erasureBlock } from "../utils/accountErasure";
import { exportAccountExtras, exportUserData } from "../utils/userData";
import { creditsFor, grant, isRefunded, reverseRefundedPurchase } from "../utils/creditStore";
import { loadListings, saveListings } from "../routes/publishedListings";
import { loadSellerStore, saveSellerStore } from "../routes/sellers";
import { loadFairs, saveFairs } from "../routes/fairs";
import { addBlock, blockedBy } from "../utils/safetyStore";
import { loadAdverts, saveAdverts } from "../utils/advertStore";
import { profileFor, saveProfile } from "../utils/advertiserStore";
import { loadPaymentRecords, purgePaymentRecords } from "../utils/advertErasure";
import { markChatRead } from "../utils/readState";
import { isConnected as ebayConnected } from "../ebay/ebaySellAuth";
import { dataPath } from "../config/dataDir";
import { RETENTION } from "../config/retention";
import { runRetention } from "../utils/retentionJob";

// Erasing an account has to take EVERYTHING with it, whoever asks (the person in the app, a request by email,
// or the clean-up of an account nobody has used for two years), except the few things the Privacy Policy
// says are kept. And an account is only called unused when it really is.

// Disconnecting eBay re-saves its token file encrypted, as it does on the real server (where this is always set).
process.env.TOKEN_ENCRYPTION_KEY = "test-only-token-encryption-key-0123456789";

let server: http.Server;
let base = "";
const ADMIN = { "x-admin-token": process.env.ADMIN_TOKEN! };
const DAY = 24 * 60 * 60_000;

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

async function call(method: string, p: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as any };
}

let counter = 0;
/** An account (made `monthsAgo` months ago) with a listing, a seller profile, a fair, credits, an eBay connection, a block and a read marker. */
function seed(label: string, monthsAgo = 0) {
  const when = new Date();
  when.setMonth(when.getMonth() - monthsAgo);
  const { account } = findOrCreateAccount(`${label}-${++counter}@example.com`, undefined, when);
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
      sellerOrigin: { country: "GB", countrySource: "edge-header", deviceRegion: "GB", deviceTimeZone: "Europe/London", flagged: false, reasons: [] },
      messages: [{ threadId: "t1", author: "buyer", deviceId: "some-buyer", message: "Still for sale?", timestamp: now }],
    } as any,
  ]);
  const store = loadSellerStore();
  store.sellers.push({ id: `S-${dev.slice(0, 8)}`, deviceId: dev, joinedAt: now, displayName: "Bike Bob" } as any);
  saveSellerStore(store);
  saveFairs([...loadFairs(), { id: `F-${dev.slice(0, 8)}`, ownerDeviceId: dev, title: "Sunday market", images: [], date: now }]);
  grant(account.id, 100, "gift");
  fs.writeFileSync(dataPath("ebaySellTokens.json"), JSON.stringify({ ...JSON.parse(fs.existsSync(dataPath("ebaySellTokens.json")) ? fs.readFileSync(dataPath("ebaySellTokens.json"), "utf8") : "{}"), [dev]: { accessToken: "a", refreshToken: "r", accessExpiresAt: 0 } }));
  addBlock(dev, "someone-else");
  markChatRead(dev, "L1:t1");
  return { account, dev, token: createSession(account.id) };
}

const ownListings = (dev: string) => loadListings().filter((l: any) => l.deviceId === dev).length;

/** An advert as the advertiser portal stores one. */
function advert(accountId: string, over: Record<string, unknown> = {}) {
  const base = new Date().toISOString();
  return {
    id: `AD-${++counter}`,
    advertiser: "Bob's Bikes",
    title: "Bikes serviced while you wait",
    tagline: "Fast and fair",
    description: "Our workshop is open seven days.",
    images: ["/uploads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg"],
    image: "/uploads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg",
    website: "https://bobsbikes.example",
    placements: ["feed"],
    scope: "local",
    postcode: "LS1 1AA",
    lat: 53.797,
    lng: -1.548,
    radiusMiles: 25,
    featured: false,
    startsAt: base,
    endsAt: new Date(Date.now() + 30 * DAY).toISOString(),
    approved: true,
    createdAt: base,
    stats: {},
    ownerAccountId: accountId,
    phone: "01234 567890",
    address: "1 High Street",
    booking: null,
    ...over,
  } as any;
}
const booking = (status: string, over: Record<string, unknown> = {}) => ({
  status,
  monthlyPence: 2000,
  launchMonthlyPence: 1000,
  launchMonths: 2,
  submittedAt: new Date().toISOString(),
  paidAt: new Date().toISOString(),
  firstPaidAt: new Date().toISOString(),
  paidThrough: new Date(Date.now() + 20 * DAY).toISOString(),
  stripe: { customerId: "cus_123", subscriptionId: "sub_123" },
  ...over,
});
const profileOf = (accountId: string) => ({
  accountId,
  businessName: "Bob's Bikes",
  website: "https://bobsbikes.example",
  phone: "01234 567890",
  address: "1 High Street",
  postcode: "LS1 1AA",
  logo: null,
  termsAcceptedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe("who counts as having left", () => {
  test("an account that is only ever used while signed in is not mistaken for one nobody uses", () => {
    const t0 = Date.now() - 30 * 30 * DAY; // signed in once, 30 months ago
    const { account } = findOrCreateAccount(`long-timer-${++counter}@example.com`, undefined, new Date(t0));
    const token = createSession(account.id, t0);
    // They keep using the app: each visit slides the session along. (No code is ever typed again.)
    for (let i = 1; i <= 25; i++) assert.ok(accountForToken(token, t0 + i * 30 * DAY), `visit ${i}`);
    const lastUse = t0 + 25 * 30 * DAY;
    // They stop. Six months later (the session ran out after 90 days) they are NOT one of the unused.
    const later = new Date(lastUse + 180 * DAY);
    assert.ok(!inactiveAccounts(RETENTION.inactiveAccountMonths, later).some((a) => a.id === account.id), "wrongly called unused 6 months after their last visit");
    // Two years after their last visit they are.
    const muchLater = new Date(lastUse + 25 * 30 * DAY);
    assert.ok(inactiveAccounts(RETENTION.inactiveAccountMonths, muchLater).some((a) => a.id === account.id), "not called unused two years after their last visit");
  });

  test("using the app moves the date at most once a day", () => {
    const t0 = Date.now() - 40 * DAY;
    const { account } = findOrCreateAccount(`once-a-day-${++counter}@example.com`, undefined, new Date(t0 - 400 * DAY));
    const token = createSession(account.id, t0);
    accountForToken(token, t0 + 2 * 60 * 60_000);
    const first = accountByEmail(account.email)!.lastActiveAt;
    assert.equal(first, new Date(t0 + 2 * 60 * 60_000).toISOString());
    accountForToken(token, t0 + 5 * 60 * 60_000); // hours later, same day
    assert.equal(accountByEmail(account.email)!.lastActiveAt, first, "rewritten within the same day");
    accountForToken(token, t0 + DAY + 3 * 60 * 60_000); // next day
    assert.notEqual(accountByEmail(account.email)!.lastActiveAt, first, "not moved on the next day");
  });

  test("an account with a live sign-in is never unused, and a brand new one is not", () => {
    const old = seed("old-but-signed-in", 30); // last signed in 30 months ago, but its session is alive now
    const fresh = seed("fresh", 0);
    const listed = inactiveAccounts(RETENTION.inactiveAccountMonths).map((a) => a.id);
    assert.ok(!listed.includes(old.account.id), "an account with a live session was called unused");
    assert.ok(!listed.includes(fresh.account.id), "a new account was called unused");
  });

  test("an account nobody has used for two years, with no live sign-in, is", () => {
    const gone = seed("gone-for-years", 30);
    // its sign-in is long over
    const t = Date.now() - 29 * 30 * DAY;
    assert.equal(accountForToken(gone.token, Date.now() + 200 * DAY), null, "the session should have run out");
    assert.ok(inactiveAccounts(RETENTION.inactiveAccountMonths, new Date(Date.now() + 200 * DAY)).some((a) => a.id === gone.account.id));
    assert.ok(t > 0);
  });
});

describe("erasing an account takes everything with it", () => {
  test("listings, profile, fairs, credits, eBay, blocks and read markers all go, and the account is gone", () => {
    const who = seed("everything");
    assert.ok(ebayConnected(who.dev), "seeded eBay connection");
    assert.equal(blockedBy(who.dev).length, 1);
    const removed = eraseAccount(who.account);
    assert.equal(removed.listingsRemoved, 1);
    assert.equal(removed.fairsRemoved, 1);
    assert.equal(removed.sellerProfileRemoved, true);
    assert.equal(removed.ebayDisconnected, true);
    assert.equal(ownListings(who.dev), 0);
    assert.equal(loadSellerStore().sellers.some((s: any) => s.deviceId === who.dev), false);
    assert.equal(loadFairs().some((f: any) => f.ownerDeviceId === who.dev), false);
    assert.equal(creditsFor(who.account.id), null);
    assert.equal(ebayConnected(who.dev), false);
    assert.equal(blockedBy(who.dev).length, 0);
    assert.equal(exportUserData(who.dev).chatReadMarkers.chats["L1:t1"], undefined);
    assert.equal(accountByEmail(who.account.email), null);
    assert.equal(accountForToken(who.token), null);
  });

  test("a refunded purchase stays refunded for good, but stops saying whose it was", () => {
    const who = seed("refunded");
    reverseRefundedPurchase("txn-refund-1", who.account.id, 50);
    const file = dataPath("creditRefunds.json");
    assert.equal(JSON.parse(fs.readFileSync(file, "utf8"))["txn-refund-1"].accountId, who.account.id);
    eraseAccount(who.account);
    const after = JSON.parse(fs.readFileSync(file, "utf8"))["txn-refund-1"];
    assert.equal(after.accountId, null, "the refund list still names the account");
    assert.ok(isRefunded("txn-refund-1"), "the refund must still block the purchase being claimed later");
    assert.ok(!fs.readFileSync(file, "utf8").includes(who.account.id), "the account id is still somewhere in the refund list");
  });

  test("a sale recorded against a buyer who then erases their account no longer names them", () => {
    const seller = seed("seller");
    const buyer = seed("buyer");
    const listing = loadListings().find((l: any) => l.deviceId === seller.dev)!;
    listing.soldToDeviceId = buyer.dev;
    listing.soldToThreadId = "t1";
    listing.soldAt = new Date().toISOString();
    saveListings(loadListings().map((l: any) => (l.id === listing.id ? listing : l)));
    assert.equal(exportUserData(buyer.dev).listingsSoldToYou.length, 1, "the buyer's own copy should show the sale");
    const removed = eraseAccount(buyer.account);
    assert.equal(removed.salesUnlinked, 1);
    const after = loadListings().find((l: any) => l.id === listing.id)!;
    assert.ok(after, "the seller's listing stays");
    assert.equal(after.soldToDeviceId, undefined);
    assert.equal(after.soldToThreadId, undefined);
    assert.ok(!JSON.stringify(loadListings()).includes(buyer.dev), "the buyer's id is still somewhere in the listings");
  });

  test("the copy a person can download includes the private extras we hold", () => {
    const who = seed("copy");
    const data = { ...exportUserData(who.dev), ...exportAccountExtras(who.account) } as any;
    assert.equal(data.listings[0].sellerOrigin.country, "GB", "the origin signals kept with the listing");
    assert.ok(data.chatReadMarkers.chats["L1:t1"], "which chats were opened");
    assert.equal(data.advertiser, null, "no advertiser data for someone who never advertised");
    assert.ok("lastActiveAt" in data.account);
  });
});

describe("a business that advertises", () => {
  test("its profile and unpaid adverts go, its pictures with them, and a never-paid advert leaves no record", () => {
    const who = seed("advertiser-unpaid");
    saveProfile(profileOf(who.account.id));
    saveAdverts([
      ...loadAdverts(),
      advert(who.account.id, { booking: booking("in-review", { paidAt: null, firstPaidAt: null, paidThrough: null, stripe: undefined }) }),
      advert(who.account.id, { booking: booking("rejected", { paidAt: null, firstPaidAt: null, paidThrough: null, stripe: undefined }) }),
    ]);
    const before = loadPaymentRecords().length;
    const removed = eraseAccount(who.account);
    assert.deepEqual(removed.advertiser, { profileRemoved: true, advertsRemoved: 2, paymentRecordsKept: 0 });
    assert.equal(profileFor(who.account.id), null);
    assert.equal(loadAdverts().filter((a: any) => a.ownerAccountId === who.account.id).length, 0);
    assert.equal(loadPaymentRecords().length, before, "nothing should be kept for adverts nobody paid for");
  });

  test("an advert that was paid for leaves only a payment record: no wording, pictures, contact details or account", () => {
    const who = seed("advertiser-paid");
    saveProfile(profileOf(who.account.id));
    saveAdverts([...loadAdverts(), advert(who.account.id, { id: "AD-PAID", booking: booking("ended", { paidThrough: new Date(Date.now() - 5 * DAY).toISOString() }) })]);
    const removed = eraseAccount(who.account);
    assert.equal(removed.advertiser.paymentRecordsKept, 1);
    assert.ok(!loadAdverts().some((a: any) => a.id === "AD-PAID"), "the advert itself must be gone");
    const record = loadPaymentRecords().find((r) => r.advertId === "AD-PAID")!;
    assert.ok(record, "the payment record");
    assert.equal(record.businessName, "Bob's Bikes");
    assert.equal(record.monthlyPence, 2000);
    assert.equal(record.stripe.subscriptionId, "sub_123");
    const text = JSON.stringify(record);
    for (const forbidden of ["Bikes serviced", "Our workshop", "bobsbikes", "01234", "High Street", "LS1", "uploads", who.account.id, who.account.email]) {
      assert.ok(!text.includes(forbidden), `the payment record still holds: ${forbidden}`);
    }
  });

  test("payment records are kept for six years, counted from the last date on them, and then deleted", () => {
    const years = (n: number) => new Date(Date.now() - n * 365 * DAY).toISOString();
    const rec = (id: string, paidThrough: string) => ({
      advertId: id, businessName: "X", monthlyPence: 1, launchMonthlyPence: null, firstPaidAt: paidThrough, paidAt: paidThrough, paidThrough,
      byCard: false, stripe: { customerId: null, subscriptionId: null }, erasedAt: paidThrough,
    });
    fs.writeFileSync(dataPath("advertPaymentRecords.json"), JSON.stringify([rec("OLD", years(7)), rec("RECENT", years(5)), ...loadPaymentRecords()]));
    assert.equal(RETENTION.paymentRecordYears, 6);
    assert.equal(purgePaymentRecords(), 1);
    const ids = loadPaymentRecords().map((r) => r.advertId);
    assert.ok(!ids.includes("OLD") && ids.includes("RECENT"));
  });

  test("a paid advert that is still renewing stops the erasure, in the app and by email, and nothing is touched", async () => {
    const who = seed("advertiser-running");
    saveProfile(profileOf(who.account.id));
    saveAdverts([...loadAdverts(), advert(who.account.id, { id: "AD-RUNNING", booking: booking("active") })]);
    assert.match(erasureBlock(who.account) ?? "", /still renewing/);

    const inApp = await call("POST", "/auth/delete-account", { confirm: "DELETE" }, { authorization: `Bearer ${who.token}`, "x-device-id": who.dev });
    assert.equal(inApp.status, 409);
    assert.equal(inApp.data.error, "advert-running");
    assert.match(inApp.data.message, /cancel it first/i);
    const byEmail = await call("POST", "/admin/delete-account", { email: who.account.email, confirm: "DELETE" }, ADMIN);
    assert.equal(byEmail.status, 409);

    assert.ok(accountByEmail(who.account.email), "the account must still be there");
    assert.equal(ownListings(who.dev), 1, "their listing must still be there");
    assert.ok(profileFor(who.account.id), "their profile must still be there");
    assert.ok(loadAdverts().some((a: any) => a.id === "AD-RUNNING"));

    // Once it is cancelled (the business keeps what it has paid for, but nothing renews) the account can go.
    saveAdverts(loadAdverts().map((a: any) => (a.id === "AD-RUNNING" ? { ...a, booking: { ...a.booking, status: "cancelling" } } : a)));
    assert.equal(erasureBlock(who.account), null);
    const done = await call("POST", "/auth/delete-account", { confirm: "DELETE" }, { authorization: `Bearer ${who.token}`, "x-device-id": who.dev });
    assert.equal(done.status, 200);
    assert.equal(accountByEmail(who.account.email), null);
    assert.equal(profileFor(who.account.id), null);
  });

  test("the downloaded copy shows a business its profile, adverts and bookings", () => {
    const who = seed("advertiser-copy");
    saveProfile(profileOf(who.account.id));
    saveAdverts([...loadAdverts(), advert(who.account.id, { id: "AD-COPY", booking: booking("active") })]);
    const extras = exportAccountExtras(who.account) as any;
    assert.equal(extras.advertiser.profile.businessName, "Bob's Bikes");
    assert.equal(extras.advertiser.adverts.length, 1);
    assert.equal(extras.advertiser.adverts[0].title, "Bikes serviced while you wait");
    assert.equal(extras.advertiser.adverts[0].booking.monthlyPence, 2000);
    assert.equal(extras.advertiser.adverts[0].booking.byCard, true);
    assert.ok(!JSON.stringify(extras).includes("sub_123"), "the payment provider's references are not for the business's copy");
    // (clean up so the running advert does not outlive this test)
    saveAdverts(loadAdverts().filter((a: any) => a.id !== "AD-COPY"));
  });
});

describe("the clean-up of accounts nobody uses", () => {
  test("erases an unused account completely, leaves a used one, and leaves a business whose paid advert is still renewing", () => {
    const unused = seed("unused-account", 30);
    const used = seed("used-account", 30);
    const advertiser = seed("unused-but-advertising", 30);
    saveProfile(profileOf(advertiser.account.id));
    saveAdverts([...loadAdverts(), advert(advertiser.account.id, { id: "AD-STILL", booking: booking("active") })]);
    // Nobody has a live sign-in except `used`, who uses the app today.
    const future = new Date(Date.now() + 200 * DAY);
    const usedToken = createSession(used.account.id, future.getTime() - DAY);
    assert.ok(accountForToken(usedToken, future.getTime()));

    const summary = runRetention(future);
    assert.ok(summary.accounts >= 1);
    assert.equal(accountByEmail(unused.account.email), null, "an unused account should be erased");
    assert.equal(ownListings(unused.dev), 0, "with its listing");
    assert.equal(ebayConnected(unused.dev), false, "and its eBay connection");
    assert.equal(creditsFor(unused.account.id), null, "and its credits");
    assert.ok(accountByEmail(used.account.email), "an account in use must stay");
    assert.ok(accountByEmail(advertiser.account.email), "an advertiser with a paid advert still renewing must stay");
    assert.ok(loadAdverts().some((a: any) => a.id === "AD-STILL"));
  });
});

describe("the server's log keeps what people scan out of it", () => {
  test("no line that writes to the log includes an item name or search text", () => {
    const BACKEND = path.resolve(__dirname, "..");
    const skip = new Set(["node_modules", "dist", "tests", "public", "data", "scripts"]);
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith(".ts")) files.push(full);
      }
    };
    walk(BACKEND);
    const offences: string[] = [];
    for (const f of files) {
      for (const [i, line] of fs.readFileSync(f, "utf8").split(/\r?\n/).entries()) {
        if (!/console\.(log|info|warn|error)\(/.test(line)) continue;
        if (line.includes("[dev]")) continue; // development only: mailer.ts prints the code to the console when NODE_ENV is not production
        if (/\$\{[^}]*\b(title|query|barcode|reg|registration|email|phone|address|postcode|message)\b[^}]*\}/.test(line)) offences.push(`${path.relative(BACKEND, f)}:${i + 1}: ${line.trim()}`);
      }
    }
    assert.deepEqual(offences, [], "a log line writes something personal or what was scanned");
  });
});
