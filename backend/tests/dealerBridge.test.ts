import "./setupEnv";
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import type { AddressInfo } from "net";
import fs from "fs";
import path from "path";
import registerBridgeRoutes from "../routes/bridge";
import { UPLOADS_DIR } from "../utils/uploadStore";
import { SECRET_WORDS, exifSeg, grayJpeg, has, tinyPng } from "./imageFixtures";
import registerMessagesRoute from "../routes/messages";
import registerPublishListingRoute from "../routes/publishListing";
import registerPublishedListingsRoute from "../routes/publishedListings";
import registerSellersRoute from "../routes/sellers";
import { accountGuard } from "../middleware/accountGuard";
import { listingStatus } from "../utils/listingStatus";
import { loadListings, saveListings } from "../routes/publishedListings";
import { runRetention } from "../utils/retentionJob";

// The Dealer OS link (built 24 Sep 2026, merged 23 Oct): FlipPilot Dealer OS lists a dealership's cars here and answers the people who
// write about them, with a key only its server holds. These run the real bridge routes together with the real sign-in guard, the
// messages and the public feed, on a throwaway data folder. They are what the branch never had in the repo.

delete process.env.DVLA_API_KEY; // no real DVLA call
delete process.env.SELLING_ALLOWED_DEVICE_IDS;
delete process.env.MARKETPLACE_PROMO_ENDS_AT;
const KEY = "test-bridge-key-that-is-long-enough-0123456789";
const DEALER = "dealership-1";

let base = "";
let server: http.Server;

before(async () => {
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json({ limit: "10mb" }));
  app.use(accountGuard); // the real one: it must let /bridge through and refuse a phone that names a dealership
  registerPublishedListingsRoute(app);
  registerPublishListingRoute(app);
  registerMessagesRoute(app);
  registerSellersRoute(app);
  registerBridgeRoutes(app);
  await new Promise<void>((ok) => {
    server = app.listen(0, "127.0.0.1", () => ok());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server?.closeAllConnections();
  server?.close();
});

let n = 0;
async function call(method: string, path: string, opts: { key?: string | null; body?: unknown; device?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": `10.8.${Math.floor(++n / 250)}.${(n % 250) + 1}` };
  if (opts.key !== null) headers["x-bridge-key"] = opts.key ?? KEY;
  if (opts.device) headers["x-device-id"] = opts.device;
  const res = await fetch(base + path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, text };
}
const put = (source: string, body: Record<string, unknown>, key?: string | null) =>
  call("PUT", `/bridge/dealers/${DEALER}/listings/${source}`, { key, body: { title: "Ford Focus 1.6 Zetec", price: 4500, dealerName: "Seaside Cars Ltd", ...body } });

// A tiny real PNG. The store reads a photo all the way through (to take its hidden details out), so it has to be a whole one.
const png = tinyPng({ width: 8, height: 8 }).toString("base64");

describe("the key", () => {
  test("with no key set on the server the link does not exist", async () => {
    delete process.env.MARKETPLACE_BRIDGE_KEY;
    assert.equal((await put("car-1", {})).status, 404);
  });

  test("a key shorter than 32 characters counts as no key", async () => {
    process.env.MARKETPLACE_BRIDGE_KEY = "too-short";
    assert.equal((await put("car-1", {}, "too-short")).status, 404);
  });

  test("with a key set, a missing or wrong key is refused and the right one is let in", async () => {
    process.env.MARKETPLACE_BRIDGE_KEY = KEY;
    assert.equal((await put("car-1", {}, null)).status, 401);
    assert.equal((await put("car-1", {}, "wrong-key-wrong-key-wrong-key-wrong-key-1")).status, 401);
    const ok = await put("car-key", {});
    assert.equal(ok.status, 200);
    assert.equal(ok.json.ok, true);
  });
});

describe("listing a dealership's cars", () => {
  before(() => {
    process.env.MARKETPLACE_BRIDGE_KEY = KEY;
  });

  test("a car needs a title and a price", async () => {
    assert.equal((await put("bad-1", { title: "" })).status, 400);
    assert.equal((await put("bad-2", { price: 0 })).status, 400);
    assert.equal((await put("bad-3", { price: "lots" })).status, 400);
    assert.equal((await call("PUT", `/bridge/dealers/bad id!/listings/x`, { body: { title: "a", price: 1 } })).status, 400);
  });

  test("it goes up as a Trade car with the dealership's name, and the public view leaks nothing private", async () => {
    const r = await put("car-a", { details: { make: "Ford", mileage: "62000" }, location: "Paignton", description: "Part of our stock." });
    assert.equal(r.json.created, true);
    const l = r.json.listing;
    assert.equal(l.title, "Ford Focus 1.6 Zetec");
    assert.equal(l.price, 4500);
    assert.equal(l.category, "Motors");
    assert.equal(l.status, "available");
    assert.equal(l.tradeSeller, true, "the card says Trade");
    for (const secret of ["dealershipId", "sourceId", "deviceId", "dvlaCheck", "messages"]) assert.equal(l[secret], undefined, `${secret} is private`);
    assert.ok(!r.text.includes("dealer:"), "the dealership's owner id never goes out");
    assert.ok(!r.text.includes(DEALER), "nor the dealership's id");

    const profile = (await call("GET", `/sellers/${l.sellerId}`, { key: null })).json.seller;
    assert.equal(profile.trade, true);
    assert.equal(profile.tradeVia, "dealer-os");
    assert.equal(profile.displayName, "Seaside Cars Ltd");
  });

  test("sending the same car again updates it rather than adding another", async () => {
    const first = await put("car-b", { price: 5000 });
    const again = await put("car-b", { price: 4750 });
    assert.equal(again.json.created, false);
    assert.equal(again.json.listingId, first.json.listingId);
    assert.equal(again.json.listing.price, 4750);
    const mine = loadListings().filter((x: any) => x.sourceId === "car-b");
    assert.equal(mine.length, 1);
  });

  test("reserved and sold are carried across", async () => {
    await put("car-c", {});
    assert.equal((await put("car-c", { status: "reserved" })).json.listing.status, "reserved");
    const sold = await put("car-c", { status: "sold" });
    assert.equal(sold.json.listing.status, "sold");
    assert.ok(sold.json.listing.soldAt);
    assert.equal((await put("car-c", { status: "available" })).json.listing.status, "available", "back on sale if the dealership says so");
  });

  test("a registration is checked as any other car's is (a malformed one is held back, the plate never shown)", async () => {
    const bad = await put("car-d", { registration: "!!" });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.error, "bad-registration");
    assert.equal(loadListings().some((x: any) => x.sourceId === "car-d"), false, "nothing half-done is left");

    // Without a DVLA key (a test, or a server that has not got one) a well-formed plate just lists.
    const good = await put("car-e", { registration: "AB12 CDE" });
    assert.equal(good.status, 200);
    assert.ok(!good.text.includes("AB12"), "the plate is never in the public view");
  });

  test("marking a car sold is never held up by a plate check", async () => {
    await put("car-f", { registration: "AB12 CDE" });
    const sold = await put("car-f", { status: "sold", registration: "!!" });
    assert.equal(sold.status, 200, "an outage or a typo must not keep a sold car on sale");
    assert.equal(sold.json.listing.status, "sold");
  });

  test("a dealership's cars are not counted against any phone's one-car limit, and cost no credits", async () => {
    for (const s of ["lim-1", "lim-2", "lim-3"]) assert.equal((await put(s, {})).status, 200);
    // a phone is still held to its own one car
    const first = await call("POST", "/create-listing", { key: null, device: "plain-phone-1", body: { deviceId: "plain-phone-1", title: "Fiat Panda", price: 1500, category: "motors" } });
    assert.equal(first.json.ok, true);
    const second = await call("POST", "/create-listing", { key: null, device: "plain-phone-1", body: { deviceId: "plain-phone-1", title: "Fiat Punto", price: 1200, category: "motors" } });
    assert.equal(second.json.error, "car-limit");
  });

  test("a dealership's cars show in the public feed, marked, and a phone's own car is not", async () => {
    await put("feed-1", { title: "Vauxhall Corsa 1.2" });
    await call("POST", "/create-listing", { key: null, device: "plain-phone-2", body: { deviceId: "plain-phone-2", title: "Honda Jazz", price: 2800, category: "motors" } });
    const feed = (await call("GET", "/published-listings", { key: null })).json as any[];
    assert.equal(feed.find((l) => l.title === "Vauxhall Corsa 1.2")?.tradeSeller, true);
    assert.equal(feed.find((l) => l.title === "Honda Jazz")?.tradeSeller, undefined);
  });
});

describe("a dealership's cars do not run out like a phone's", () => {
  before(() => {
    process.env.MARKETPLACE_BRIDGE_KEY = KEY;
  });

  test("they live and die with the dealership's stock: no 30-day clock, and the clean-up leaves them", async () => {
    const r = await put("old-1", { title: "Old Stock Estate" });
    const id = r.json.listingId;
    const listings = loadListings();
    const l = listings.find((x: any) => x.id === id)!;
    l.createdAt = new Date(Date.now() - 400 * 86_400_000).toISOString();
    saveListings(listings);
    assert.equal(listingStatus(loadListings().find((x: any) => x.id === id)), "available");
    runRetention();
    assert.ok(loadListings().some((x: any) => x.id === id), "the clean-up job keeps it");

    // ...while a phone's listing of that age is gone (so the exemption is the trade flag and nothing else)
    const mine = await call("POST", "/create-listing", { key: null, device: "plain-phone-3", body: { deviceId: "plain-phone-3", title: "Old Phone Listing", price: 10, category: "home" } });
    const all = loadListings();
    const p = all.find((x: any) => x.id === mine.json.listing.id)!;
    p.createdAt = new Date(Date.now() - 400 * 86_400_000).toISOString();
    saveListings(all);
    runRetention();
    assert.equal(loadListings().some((x: any) => x.id === mine.json.listing.id), false);
  });
});

describe("photos", () => {
  before(() => {
    process.env.MARKETPLACE_BRIDGE_KEY = KEY;
  });

  test("a photo goes up on its own, and a car can use it; a made-up path is dropped", async () => {
    const up = await call("POST", `/bridge/dealers/${DEALER}/photos`, { body: { imageBase64: png } });
    assert.equal(up.status, 200);
    assert.match(up.json.path, /^\/uploads\/[a-f0-9]+\.png$/);
    const car = await put("photo-1", { photos: [up.json.path, "/uploads/0000000000000000000000000000000a.png", "https://evil.example/x.png"] });
    assert.equal(car.json.listing.photos.length, 1, "only the one this dealership uploaded");
  });

  test("something that is not a photo is refused", async () => {
    const text = Buffer.from("this is not an image at all, it is only text, repeated. ".repeat(10)).toString("base64");
    assert.equal((await call("POST", `/bridge/dealers/${DEALER}/photos`, { body: { imageBase64: text } })).status, 400);
    assert.equal((await call("POST", `/bridge/dealers/${DEALER}/photos`, { body: { imageBase64: "x" } })).status, 400);
  });

  test("what a camera hides in a photo (where it was taken, which camera) is taken out before it is kept", async () => {
    const dirty = grayJpeg([exifSeg({ orientation: 6, gps: true })]);
    const up = await call("POST", `/bridge/dealers/${DEALER}/photos`, { body: { imageBase64: dirty.toString("base64") } });
    assert.equal(up.status, 200);
    const kept = fs.readFileSync(path.join(UPLOADS_DIR, path.basename(up.json.path)));
    for (const word of SECRET_WORDS) assert.ok(!has(kept, word), `"${word}" must not be kept`);
    assert.ok(kept.length < dirty.length, "what is kept is smaller than what was sent");
    assert.deepEqual([...kept.subarray(0, 2)], [0xff, 0xd8], "and is still a JPEG");
  });

  test("a photo that cannot be read is refused with a message, and nothing is kept", async () => {
    const filesNow = () => (fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR).length : 0);
    const files = filesNow();
    const damaged = grayJpeg([exifSeg({ gps: true })]).subarray(0, 120);
    const up = await call("POST", `/bridge/dealers/${DEALER}/photos`, { body: { imageBase64: damaged.toString("base64") } });
    assert.equal(up.status, 400);
    assert.match(up.json.error, /couldn't be read/);
    assert.equal(filesNow(), files, "nothing written");
  });

  test("one dealership cannot use another's photo", async () => {
    const up = await call("POST", `/bridge/dealers/other-dealership/photos`, { body: { imageBase64: png } });
    const car = await put("photo-2", { photos: [up.json.path] });
    assert.equal(car.json.listing.photos.length, 0);
  });
});

describe("people writing about a car", () => {
  let listingId: number;
  before(async () => {
    process.env.MARKETPLACE_BRIDGE_KEY = KEY;
    listingId = (await put("chat-1", { title: "Mini Cooper Chat Car" })).json.listingId;
  });

  test("a buyer's message reaches the dealership without saying who they are", async () => {
    const sent = await call("POST", `/messages/${listingId}`, { key: null, device: "buyer-phone-secret-id", body: { message: "Is it still available?" } });
    assert.equal(sent.json.ok, true);

    const pulled = await call("GET", `/bridge/dealers/${DEALER}/messages`);
    const m = pulled.json.messages.find((x: any) => x.listingId === listingId);
    assert.equal(m.text, "Is it still available?");
    assert.equal(m.sourceId, "chat-1");
    assert.equal(m.vehicleTitle, "Mini Cooper Chat Car");
    assert.match(m.threadId, /^[a-f0-9]{16}$/, "an opaque thread id");
    assert.ok(!pulled.text.includes("buyer-phone-secret-id"), "the buyer's phone id never leaves");
  });

  test("only what is newer than 'after' comes back", async () => {
    const all = (await call("GET", `/bridge/dealers/${DEALER}/messages`)).json.messages;
    const last = all[all.length - 1];
    const later = await call("GET", `/bridge/dealers/${DEALER}/messages?after=${encodeURIComponent(last.timestamp)}`);
    assert.equal(later.json.messages.length, 0);
  });

  test("the dealership reads the conversation and answers, and the buyer sees the answer", async () => {
    const m = (await call("GET", `/bridge/dealers/${DEALER}/messages`)).json.messages.find((x: any) => x.listingId === listingId);
    const thread = await call("GET", `/bridge/dealers/${DEALER}/threads/${listingId}/${m.threadId}`);
    assert.equal(thread.json.messages[0].from, "buyer");

    const reply = await call("POST", `/bridge/dealers/${DEALER}/threads/${listingId}/${m.threadId}/reply`, { body: { message: "Yes, come and see it." } });
    assert.equal(reply.json.ok, true);

    const buyerView = await call("GET", `/messages/${listingId}`, { key: null, device: "buyer-phone-secret-id" });
    const texts = JSON.stringify(buyerView.json);
    assert.ok(texts.includes("Yes, come and see it."));
  });

  test("a dealership cannot start a conversation, or write into one that is not its own", async () => {
    const none = await call("POST", `/bridge/dealers/${DEALER}/threads/${listingId}/0000000000000000/reply`, { body: { message: "Hello?" } });
    assert.equal(none.status, 404);
    const other = await call("POST", `/bridge/dealers/other-dealership/threads/${listingId}/0000000000000000/reply`, { body: { message: "Hello?" } });
    assert.equal(other.status, 404);
    // ...not even into a REAL conversation: the right thread id, but another dealership's name
    const real = (await call("GET", `/bridge/dealers/${DEALER}/messages`)).json.messages.find((x: any) => x.listingId === listingId);
    const intruder = await call("POST", `/bridge/dealers/other-dealership/threads/${listingId}/${real.threadId}/reply`, { body: { message: "I am not their dealership" } });
    assert.equal(intruder.status, 404);
    const stolenRead = await call("GET", `/bridge/dealers/other-dealership/threads/${listingId}/${real.threadId}`);
    assert.equal(stolenRead.status, 404);
    const empty = await call("POST", `/bridge/dealers/${DEALER}/threads/${listingId}/x/reply`, { body: { message: "   " } });
    assert.equal(empty.status, 400);
  });

  test("another dealership sees none of it", async () => {
    const pulled = await call("GET", `/bridge/dealers/other-dealership/messages`);
    assert.equal(pulled.json.messages.length, 0);
  });
});

describe("taking a car off", () => {
  before(() => {
    process.env.MARKETPLACE_BRIDGE_KEY = KEY;
  });

  test("it is removed, with its photo, and a second try says there was nothing to remove", async () => {
    const up = await call("POST", `/bridge/dealers/${DEALER}/photos`, { body: { imageBase64: png } });
    await put("gone-1", { photos: [up.json.path] });
    const removed = await call("DELETE", `/bridge/dealers/${DEALER}/listings/gone-1`);
    assert.equal(removed.json.removed, true);
    assert.equal(loadListings().some((x: any) => x.sourceId === "gone-1"), false);
    assert.equal((await call("DELETE", `/bridge/dealers/${DEALER}/listings/gone-1`)).json.removed, false);
  });

  test("another dealership cannot take it off", async () => {
    await put("keep-1", {});
    assert.equal((await call("DELETE", `/bridge/dealers/other-dealership/listings/keep-1`)).json.removed, false);
    assert.equal(loadListings().some((x: any) => x.sourceId === "keep-1"), true);
  });
});

describe("the sign-in guard", () => {
  test("a phone cannot name a dealership's id to act as it", async () => {
    const r = await call("POST", "/create-listing", { key: null, device: `dealer:${DEALER}`, body: { deviceId: `dealer:${DEALER}`, title: "Fake", price: 1, category: "motors" } });
    assert.equal(r.status, 403);
    assert.equal(r.json.error, "identity-mismatch");
    const msg = await call("POST", "/messages/1", { key: null, device: `dealer:${DEALER}`, body: { message: "hi" } });
    assert.ok(msg.status >= 400);
  });

  test("the bridge does not need a phone's sign-in, only its key", async () => {
    process.env.MARKETPLACE_BRIDGE_KEY = KEY;
    const r = await put("guard-1", {});
    assert.equal(r.status, 200);
  });
});
