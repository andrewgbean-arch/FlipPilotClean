import "./setupEnv";
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import zlib from "zlib";
import http from "http";
import express from "express";
import { quote, pounds } from "../utils/advertPricing";
import { Advert, holdsSpace, isLive, loadAdverts, placementLoad, saveAdverts, toPublicAdvert } from "../utils/advertStore";
import { billing, checkoutRequest, formEncode, verifyStripeSignature } from "../utils/advertBilling";
import { addMonths, freeMonthState, markPaid } from "../utils/advertBooking";
import { dueReminders, runAdvertReminders } from "../utils/advertReminders";
import { applyStripeEvent } from "../routes/stripeWebhook";
import { accountGuard } from "../middleware/accountGuard";
import { createSession, findOrCreateAccount } from "../utils/accountStore";
import registerAdvertsRoute from "../routes/adverts";
import registerAdvertiserPortalRoutes from "../routes/advertiserPortal";

// The advertising portal: prices, when an advert shows, Stripe's messages, and the whole journey
// through the real routes (sign in, business details, quote, send, approve, pay, show).

/* ------------------------------ helpers ------------------------------ */

/** A real (small) PNG, so the picture checks see a genuine image. */
function png(w = 16, h = 16): string {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  // Random pixels, so it doesn't compress to almost nothing (the upload check wants a real-sized picture).
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), crypto.randomBytes(w)])));
  const file = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return "data:image/png;base64," + file.toString("base64");
}

let server: http.Server;
let base = "";
const ADMIN = { "x-admin-token": process.env.ADMIN_TOKEN! };

function signIn(email: string): string {
  const { account } = findOrCreateAccount(email, undefined);
  return createSession(account.id);
}

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
const as = (token: string) => ({ authorization: `Bearer ${token}` });
const today = () => new Date().toISOString().slice(0, 10);
const nearLeeds = { "x-approx-location": "53.80,-1.55" };

before(async () => {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(accountGuard);
  registerAdvertsRoute(app);
  registerAdvertiserPortalRoutes(app);
  await new Promise<void>((ok) => {
    server = app.listen(0, "127.0.0.1", () => ok());
  });
  const addr = server.address() as { port: number };
  base = `http://127.0.0.1:${addr.port}`;
});
after(() => {
  server?.close();
});

/* ------------------------------ prices ------------------------------ */

describe("the price list", () => {
  test("each place on its own, in pence, with half price for the first 2 months", () => {
    const q = quote(["feed"], "local", true);
    assert.equal(q.ok, true);
    if (!q.ok) return;
    assert.equal(q.monthlyPence, 2500);
    assert.equal(q.launchMonthlyPence, 1250);
    assert.equal(q.launchMonths, 2);
    assert.deepEqual(quote(["messages"], "local", true).ok && (quote(["messages"], "local", true) as any).monthlyPence, 1500);
    assert.equal((quote(["scan-panel"], "local", true) as any).monthlyPence, 2900);
    assert.equal((quote(["scan-full"], "local", true) as any).monthlyPence, 9900);
  });

  test("the three shared places together are £59, and it says what that saves", () => {
    const q = quote(["messages", "feed", "scan-panel"], "local", true) as any;
    assert.equal(q.monthlyPence, 5900);
    assert.equal(q.bundle.savedPence, 1500 + 2500 + 2900 - 5900);
    assert.equal(q.launchMonthlyPence, 2950);
  });

  test("the full page adds on top of messages and feed, but can't go with the cross-over", () => {
    assert.equal((quote(["messages", "feed", "scan-full"], "local", true) as any).monthlyPence, 1500 + 2500 + 9900);
    const both = quote(["scan-full", "scan-panel"], "local", true);
    assert.equal(both.ok, false);
  });

  test("nationwide is priced by a person, and boot fairs aren't sold here", () => {
    assert.equal(quote(["feed"], "nationwide", true).ok, false);
    assert.equal(quote(["bootfairs"], "local", true).ok, false);
    assert.equal(quote([], "local", true).ok, false);
  });

  test("with the launch offer switched off there is no half price", () => {
    const q = quote(["feed"], "local", false) as any;
    assert.equal(q.launchMonthlyPence, null);
    assert.equal(q.launchMonths, 0);
  });

  test("pounds are written the way people write them", () => {
    assert.equal(pounds(1500), "£15");
    assert.equal(pounds(1250), "£12.50");
    assert.equal(pounds(5900), "£59");
  });
});

/* ------------------------------ showing ------------------------------ */

function portalAd(over: Partial<Advert> = {}): Advert {
  const now = Date.now();
  return {
    id: crypto.randomBytes(4).toString("hex"),
    advertiser: "Test Co",
    title: "Test",
    tagline: "",
    description: "",
    images: ["/uploads/x.png"],
    image: "/uploads/x.png",
    website: "",
    placements: ["scan-full"],
    scope: "local",
    postcode: "LS1 1AA",
    lat: 53.797,
    lng: -1.548,
    radiusMiles: 25,
    featured: false,
    startsAt: new Date(now - 3600e3).toISOString(),
    endsAt: new Date(now + 20 * 86400e3).toISOString(),
    approved: true,
    createdAt: new Date(now).toISOString(),
    stats: {},
    ownerAccountId: "acc1",
    booking: {
      status: "active",
      monthlyPence: 9900,
      launchMonthlyPence: 4950,
      launchMonths: 2,
      submittedAt: new Date(now).toISOString(),
      paidThrough: new Date(now + 20 * 86400e3).toISOString(),
    },
    ...over,
  };
}

describe("when a business's advert shows", () => {
  test("only once approved AND paid for, and only while paid up", () => {
    assert.equal(isLive(portalAd()), true);
    assert.equal(isLive(portalAd({ approved: false })), false);
    const unpaid = portalAd();
    unpaid.booking = { ...unpaid.booking!, status: "awaiting-payment", paidThrough: null };
    assert.equal(isLive(unpaid), false);
    const lapsed = portalAd();
    lapsed.booking = { ...lapsed.booking!, paidThrough: new Date(Date.now() - 1000).toISOString() };
    assert.equal(isLive(lapsed), false);
    // One made by hand in the admin routes has no booking and shows as before.
    assert.equal(isLive(portalAd({ booking: null, ownerAccountId: null })), true);
  });

  test("an unpaid booking holds its place only until its hold runs out", () => {
    const held = portalAd();
    held.booking = { ...held.booking!, status: "in-review", paidThrough: null, holdUntil: new Date(Date.now() + 86400e3).toISOString() };
    assert.equal(holdsSpace(held), true);
    held.booking.holdUntil = new Date(Date.now() - 1000).toISOString();
    assert.equal(holdsSpace(held), false);
    const rejected = portalAd();
    rejected.booking = { ...rejected.booking!, status: "rejected" };
    assert.equal(holdsSpace(rejected), false);
  });

  test("counts how many share a place in an area", () => {
    const a = portalAd();
    const b = portalAd();
    const load = placementLoad(portalAd(), [a, b])[0];
    assert.equal(load.count, 3);
    assert.equal(load.limit, 3);
    const farAway = portalAd({ postcode: "M1 1AE", lat: 51.5, lng: -0.12, radiusMiles: 10 });
    assert.equal(placementLoad(farAway, [a, b])[0].count, 1);
  });

  test("nobody outside sees who booked it, or the booking", () => {
    const pub: any = toPublicAdvert(portalAd({ phone: "0113 496 0000", cta: "call" }));
    assert.equal(pub.ownerAccountId, undefined);
    assert.equal(pub.booking, undefined);
    assert.equal(pub.postcode, undefined);
    assert.equal(pub.phone, "0113 496 0000");
    assert.equal(pub.cta, "call");
  });
});

/* ------------------------------ Stripe ------------------------------ */

describe("Stripe", () => {
  const secret = "whsec_testsecret";
  const body = Buffer.from(JSON.stringify({ type: "invoice.paid" }));
  const sign = (t: number, b = body, s = secret) => `t=${t},v1=${crypto.createHmac("sha256", s).update(`${t}.${b.toString()}`).digest("hex")}`;

  test("only believes messages signed with our secret, and not old ones", () => {
    const now = Date.now();
    const t = Math.floor(now / 1000);
    assert.equal(verifyStripeSignature(body, sign(t), secret, now), true);
    assert.equal(verifyStripeSignature(body, sign(t, body, "whsec_other"), secret, now), false);
    assert.equal(verifyStripeSignature(Buffer.from('{"type":"x"}'), sign(t), secret, now), false);
    assert.equal(verifyStripeSignature(body, sign(t - 600), secret, now), false);
    assert.equal(verifyStripeSignature(body, undefined, secret, now), false);
  });

  test("sends Stripe the booked price monthly, with the half-price coupon, and a trial up to a later start", () => {
    const ad = portalAd({ startsAt: new Date(Date.now() + 10 * 86400e3).toISOString() });
    ad.booking = { ...ad.booking!, status: "awaiting-payment" };
    const req: any = checkoutRequest(ad, "shop@example.com", true);
    assert.equal(req.mode, "subscription");
    assert.equal(req.line_items[0].price_data.unit_amount, 9900);
    assert.equal(req.line_items[0].price_data.recurring.interval, "month");
    assert.equal(req.line_items[0].price_data.currency, "gbp");
    assert.equal(req.discounts[0].coupon, "flippilot-ads-launch-half-price");
    assert.equal(req.subscription_data.trial_end, Math.floor(new Date(ad.startsAt).getTime() / 1000));
    assert.equal(req.metadata.advertId, ad.id);
    const soon: any = checkoutRequest(portalAd(), "shop@example.com", false);
    assert.equal(soon.subscription_data.trial_end, undefined);
    assert.equal(soon.discounts, undefined);
    const form = formEncode({ line_items: { 0: { price_data: { unit_amount: 9900 } } } }).join("&");
    assert.equal(form, encodeURIComponent("line_items[0][price_data][unit_amount]") + "=9900");
  });

  test("a completed checkout and a paid invoice make it live up to the end of the paid month", () => {
    const now = new Date();
    const ad = portalAd({ startsAt: new Date(now.getTime() - 86400e3).toISOString() });
    ad.booking = { ...ad.booking!, status: "awaiting-payment", paidThrough: null, holdUntil: new Date(now.getTime() + 86400e3).toISOString() };
    const all = [ad];
    applyStripeEvent({ type: "checkout.session.completed", data: { object: { id: "cs_1", customer: "cus_1", subscription: "sub_1", metadata: { advertId: ad.id } } } }, all, now);
    assert.equal(ad.booking!.status, "active");
    assert.equal(ad.booking!.stripe?.subscriptionId, "sub_1");
    assert.equal(isLive(ad, now), false, "not before the money has arrived");
    const end = Math.floor(now.getTime() / 1000) + 30 * 86400;
    const change = applyStripeEvent({ type: "invoice.paid", data: { object: { subscription: "sub_1", amount_paid: 4950, lines: { data: [{ period: { end } }] } } } }, all, now);
    assert.equal(change?.email, "live");
    assert.equal(ad.booking!.paidThrough, new Date(end * 1000).toISOString());
    assert.equal(ad.endsAt, ad.booking!.paidThrough);
    assert.equal(isLive(ad, now), true);
  });

  test("the £0 invoice at the start of a trial pays for nothing", () => {
    const ad = portalAd();
    ad.booking = { ...ad.booking!, status: "active", paidThrough: null, stripe: { subscriptionId: "sub_2" } };
    assert.equal(applyStripeEvent({ type: "invoice.paid", data: { object: { subscription: "sub_2", amount_paid: 0, total: 0, lines: { data: [{ period: { end: 2e9 } }] } } } }, [ad]), null);
    assert.equal(ad.booking!.paidThrough, null);
  });

  test("cancelling runs to the end of the paid month, and a deleted subscription ends it", () => {
    const ad = portalAd();
    ad.booking = { ...ad.booking!, stripe: { subscriptionId: "sub_3" } };
    applyStripeEvent({ type: "customer.subscription.updated", data: { object: { id: "sub_3", cancel_at_period_end: true } } }, [ad]);
    assert.equal(ad.booking!.status, "cancelling");
    assert.equal(ad.endsAt, ad.booking!.paidThrough);
    const change = applyStripeEvent({ type: "customer.subscription.deleted", data: { object: { id: "sub_3" } } }, [ad]);
    assert.equal(ad.booking!.status, "ended");
    assert.equal(change?.email, "ended");
  });
});

/* ------------------------------ the journey ------------------------------ */

describe("a business books an advert", () => {
  const shop = signIn(`shop-${Date.now()}@example.com`);
  const rival = signIn(`rival-${Date.now()}@example.com`);
  let advertId = "";

  test("needs to be signed in", async () => {
    const r = await call("GET", "/advertiser/me");
    assert.equal(r.status, 401);
  });

  test("sets up the business, and must accept the terms first", async () => {
    const details = { businessName: "Leeds Vintage Co", website: "leedsvintage.co.uk", phone: "0113 496 0000", address: "12 Call Lane, Leeds", postcode: "LS1 1AA", logoBase64: png() };
    const refused = await call("PUT", "/advertiser/profile", details, as(shop));
    assert.equal(refused.status, 400);
    const ok = await call("PUT", "/advertiser/profile", { ...details, acceptTerms: true }, as(shop));
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(ok.data.profile.website, "https://leedsvintage.co.uk/");
    assert.match(ok.data.profile.logo, /\/uploads\//);
    const badPhone = await call("PUT", "/advertiser/profile", { phone: "12345" }, as(shop));
    assert.equal(badPhone.status, 400);
  });

  test("gets a price and how many places are left in its area", async () => {
    const r = await call("POST", "/advertiser/quote", { placements: ["feed", "messages"], postcode: "LS1 1AA", radiusMiles: 25, startsAt: today() }, as(shop));
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.quote.monthlyPence, 4000);
    assert.equal(r.data.quote.launchMonthlyPence, 2000);
    const full = r.data.availability.find((a: any) => a.placement === "scan-full");
    assert.equal(full.placesLeft, 3);
  });

  test("rude words are refused before anything is saved", async () => {
    const r = await call("POST", "/advertiser/adverts", { title: "Sh1t hot deals", placements: ["feed"], radiusMiles: 25, startsAt: today(), imagesBase64: [png()] }, as(shop));
    assert.equal(r.status, 422);
    assert.equal(loadAdverts().length, 0);
  });

  test("sends an advert, which waits for a person (a first advert is never approved by itself)", async () => {
    const r = await call("POST", "/advertiser/adverts", {
      title: "Vintage furniture, fairly priced",
      tagline: "New stock every Saturday",
      description: "Mid-century chairs, tables and lamps, restored in Leeds.",
      cta: "call",
      placements: ["feed", "messages"],
      radiusMiles: 25,
      startsAt: today(),
      imagesBase64: [png(), png(20, 20)],
    }, as(shop));
    assert.equal(r.status, 200, JSON.stringify(r.data));
    advertId = r.data.advert.id;
    assert.equal(r.data.advert.state, "in-review");
    assert.equal(r.data.advert.booking.monthlyPence, 4000);
    assert.equal(r.data.advert.cta, "call");
    assert.equal(r.data.advert.phone, "0113 496 0000");
    assert.equal(r.data.advert.images.length, 2);
    // Not shown to anyone yet.
    const feed = await call("GET", "/adverts?placement=feed", undefined, nearLeeds);
    assert.equal(feed.data.adverts.length, 0);
  });

  test("another business can't see or change it", async () => {
    const mineList = await call("GET", "/advertiser/me", undefined, as(rival));
    assert.equal(mineList.data.adverts.length, 0);
    assert.equal((await call("GET", `/advertiser/adverts/${advertId}/report`, undefined, as(rival))).status, 404);
    assert.equal((await call("POST", `/advertiser/adverts/${advertId}/withdraw`, {}, as(rival))).status, 404);
  });

  test("can't pay before it's approved", async () => {
    const r = await call("POST", `/advertiser/adverts/${advertId}/pay`, {}, as(shop));
    assert.equal(r.status, 409);
  });

  test("approved by a person, it waits to be paid for, and still isn't shown", async () => {
    const r = await call("PATCH", `/admin/adverts/${advertId}`, { approved: true }, ADMIN);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.advert.booking.status, "awaiting-payment");
    // The admin page mustn't call it live before it's paid for.
    assert.equal(r.data.advert.state, "awaiting-payment");
    const feed = await call("GET", "/adverts?placement=feed", undefined, nearLeeds);
    assert.equal(feed.data.adverts.length, 0);
  });

  test("without card payments switched on, paying asks for an invoice", async () => {
    const r = await call("POST", `/advertiser/adverts/${advertId}/pay`, {}, as(shop));
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.mode, "invoice");
    assert.equal(r.data.advert.booking.invoiceRequested, true);
  });

  test("marked paid, it shows in the app near the business, with its button, and nowhere else", async () => {
    const r = await call("POST", `/admin/adverts/${advertId}/mark-paid`, { months: 1 }, ADMIN);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const feed = await call("GET", "/adverts?placement=feed", undefined, nearLeeds);
    assert.equal(feed.data.adverts.length, 1);
    const shown = feed.data.adverts[0];
    assert.equal(shown.title, "Vintage furniture, fairly priced");
    assert.equal(shown.cta, "call");
    assert.equal(shown.phone, "0113 496 0000");
    assert.match(shown.logo, /^http:\/\/127\.0\.0\.1:\d+\/uploads\//);
    assert.equal(shown.booking, undefined);
    assert.equal(shown.ownerAccountId, undefined);
    const manchester = await call("GET", "/adverts?placement=feed", undefined, { "x-approx-location": "53.48,-2.24" });
    assert.equal(manchester.data.adverts.length, 0);
    const me = await call("GET", "/advertiser/me", undefined, as(shop));
    assert.equal(me.data.adverts[0].state, "live");
  });

  test("editing its words sends it back to be read before it shows again", async () => {
    const r = await call("PATCH", `/advertiser/adverts/${advertId}`, { title: "Vintage furniture, restored in Leeds" }, as(shop));
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.advert.state, "in-review");
    assert.equal(r.data.advert.booking.status, "active", "still paid for");
    const feed = await call("GET", "/adverts?placement=feed", undefined, nearLeeds);
    assert.equal(feed.data.adverts.length, 0);
    await call("PATCH", `/admin/adverts/${advertId}`, { approved: true }, ADMIN);
    const back = await call("GET", "/adverts?placement=feed", undefined, nearLeeds);
    assert.equal(back.data.adverts.length, 1);
  });

  test("its report counts showings and taps by day, one showing per phone per day", async () => {
    await call("POST", `/adverts/${advertId}/event`, { type: "view", viewer: "phone-a" });
    // The same phone seeing it again today isn't another showing.
    const again = await call("POST", `/adverts/${advertId}/event`, { type: "view", viewer: "phone-a" });
    assert.equal(again.data.counted, false);
    await call("POST", `/adverts/${advertId}/event`, { type: "click", viewer: "phone-a" });
    const r = await call("GET", `/advertiser/adverts/${advertId}/report`, undefined, as(shop));
    assert.equal(r.status, 200);
    assert.equal(r.data.report.timesShown, 1);
    assert.equal(r.data.report.timesTapped, 1);
  });
});

describe("full areas and turned-down adverts", () => {
  const first = signIn(`first-${Date.now()}@example.com`);
  const second = signIn(`second-${Date.now()}@example.com`);
  const details = { businessName: "Scan Shop", website: "https://scanshop.co.uk", postcode: "LS2 7HY", acceptTerms: true };

  test("a full scan page in an area is refused, until the unpaid hold runs out", async () => {
    process.env.MAX_FULL_PAGE_PER_AREA = "1";
    try {
      await call("PUT", "/advertiser/profile", details, as(first));
      await call("PUT", "/advertiser/profile", { ...details, businessName: "Second Shop" }, as(second));
      const booking = { title: "Big sale this weekend", placements: ["scan-full"], radiusMiles: 10, startsAt: today(), imagesBase64: [png()] };
      const a = await call("POST", "/advertiser/adverts", booking, as(first));
      assert.equal(a.status, 200, JSON.stringify(a.data));
      const quoteFull = await call("POST", "/advertiser/quote", { placements: ["scan-full"], radiusMiles: 10, startsAt: today() }, as(second));
      assert.equal(quoteFull.data.availability.find((x: any) => x.placement === "scan-full").placesLeft, 0);
      const b = await call("POST", "/advertiser/adverts", booking, as(second));
      assert.equal(b.status, 409);
      // The first business never paid: once its hold runs out, the place is free again.
      const all = loadAdverts();
      const held = all.find((x) => x.id === a.data.advert.id)!;
      held.booking!.holdUntil = new Date(Date.now() - 1000).toISOString();
      saveAdverts(all);
      const c = await call("POST", "/advertiser/adverts", booking, as(second));
      assert.equal(c.status, 200, JSON.stringify(c.data));
    } finally {
      delete process.env.MAX_FULL_PAGE_PER_AREA;
    }
  });

  test("turned down with a reason, the business sees why, changes it and sends it again", async () => {
    const me = await call("GET", "/advertiser/me", undefined, as(second));
    const id = me.data.adverts[0].id;
    const r = await call("POST", `/admin/adverts/${id}/reject`, { reason: "The photo doesn't show what you sell." }, ADMIN);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const seen = await call("GET", "/advertiser/me", undefined, as(second));
    assert.equal(seen.data.adverts[0].state, "rejected");
    assert.equal(seen.data.adverts[0].booking.rejectedReason, "The photo doesn't show what you sell.");
    const again = await call("PATCH", `/advertiser/adverts/${id}`, { imagesBase64: [png(24, 24)] }, as(second));
    assert.equal(again.status, 200, JSON.stringify(again.data));
    assert.equal(again.data.advert.state, "in-review");
    assert.equal(again.data.advert.booking.rejectedReason, null);
  });

  test("an unpaid advert can be withdrawn; a paid one is cancelled instead", async () => {
    const me = await call("GET", "/advertiser/me", undefined, as(second));
    const id = me.data.adverts[0].id;
    const w = await call("POST", `/advertiser/adverts/${id}/withdraw`, {}, as(second));
    assert.equal(w.status, 200);
    assert.equal(w.data.advert.state, "withdrawn");
    const pay = await call("POST", `/advertiser/adverts/${id}/pay`, {}, as(second));
    assert.equal(pay.status, 409);
  });
});

describe("honest counts", () => {
  test("one address can't pile up an advert's figures, however many phones it pretends to be", async () => {
    const { shouldCount, resetEventGate } = await import("../utils/advertEventGate.js");
    resetEventGate();
    let counted = 0;
    for (let i = 0; i < 100; i++) if (shouldCount("ad1", "view", `fake-${i}`, "203.0.113.9")) counted++;
    assert.equal(counted, 40);
    // Another address, and another advert, are counted separately.
    assert.equal(shouldCount("ad1", "view", "real-phone", "198.51.100.7"), true);
    assert.equal(shouldCount("ad2", "view", "fake-1", "203.0.113.9"), true);
    // Without an id, the address stands in: one view per address per advert per day.
    assert.equal(shouldCount("ad3", "view", null, "198.51.100.8"), true);
    assert.equal(shouldCount("ad3", "view", null, "198.51.100.8"), false);
  });
});

describe("the launch offer's free month", () => {
  const DAY = 86400e3;
  const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

  test("can be asked for once the first paid month is over, for two months, while it's running", () => {
    const ad = portalAd();
    assert.equal(freeMonthState(ad).state, "none"); // never paid
    ad.booking!.firstPaidAt = ago(10);
    assert.equal(freeMonthState(ad).state, "not-yet");
    ad.booking!.firstPaidAt = ago(40);
    assert.equal(freeMonthState(ad).state, "can-ask");
    ad.booking!.status = "cancelling";
    assert.equal(freeMonthState(ad).state, "not-running");
    ad.booking!.status = "active";
    ad.booking!.firstPaidAt = ago(100);
    assert.equal(freeMonthState(ad).state, "too-late");
    const noOffer = portalAd({ booking: { ...portalAd().booking!, launchMonths: 0, launchMonthlyPence: null, firstPaidAt: ago(40) } });
    assert.equal(freeMonthState(noOffer).state, "none");
  });

  test("the first paid month is remembered, and later payments don't move it", () => {
    const ad = portalAd({ booking: { ...portalAd().booking!, status: "awaiting-payment", paidThrough: null } });
    const t0 = new Date();
    markPaid(ad, 1, t0);
    const first = ad.booking!.firstPaidAt;
    assert.ok(first);
    markPaid(ad, 1, new Date(t0.getTime() + 20 * DAY));
    assert.equal(ad.booking!.firstPaidAt, first);

    const card = portalAd({ booking: { ...portalAd().booking!, stripe: { subscriptionId: "sub_1" } } });
    const invoice = (end: number) => ({ type: "invoice.paid", data: { object: { subscription: "sub_1", amount_paid: 9900, total: 9900, lines: { data: [{ period: { end } }] } } } });
    applyStripeEvent(invoice(Math.floor(Date.now() / 1000) + 30 * 86400), [card]);
    const cardFirst = card.booking!.firstPaidAt;
    assert.ok(cardFirst);
    applyStripeEvent(invoice(Math.floor(Date.now() / 1000) + 60 * 86400), [card], new Date(Date.now() + 30 * DAY));
    assert.equal(card.booking!.firstPaidAt, cardFirst);
  });

  test("a month paid by the free-month credit still counts as paid (the invoice isn't £0)", () => {
    const ad = portalAd({ booking: { ...portalAd().booking!, stripe: { subscriptionId: "sub_2" } } });
    const end = Math.floor(Date.now() / 1000) + 45 * 86400;
    // Stripe used the credit: nothing taken from the card, but the invoice was for a full month.
    const change = applyStripeEvent({ type: "invoice.paid", data: { object: { subscription: "sub_2", amount_paid: 0, total: 9900, lines: { data: [{ period: { end } }] } } } }, [ad]);
    assert.ok(change);
    assert.equal(ad.booking!.paidThrough, new Date(end * 1000).toISOString());
  });

  test("paid by invoice: the business asks, a person adds it, and it runs a month longer", async () => {
    const email = `quiet-${Date.now()}@example.com`;
    const token = signIn(email);
    const { account } = findOrCreateAccount(email, undefined);
    const other = signIn(`nosy-${Date.now()}@example.com`);
    const ad = portalAd({ ownerAccountId: account.id, title: "Quiet month shop" });
    ad.booking!.firstPaidAt = ago(5);
    saveAdverts([...loadAdverts(), ad]);

    let r = await call("POST", `/advertiser/adverts/${ad.id}/free-month`, {}, as(token));
    assert.equal(r.status, 409, "not before the first month is over");
    assert.match(r.data.error, /first paid month is over/);

    const all = loadAdverts();
    all.find((a) => a.id === ad.id)!.booking!.firstPaidAt = ago(35);
    saveAdverts(all);

    r = await call("POST", `/advertiser/adverts/${ad.id}/free-month`, { note: "Hardly any taps" }, as(other));
    assert.equal(r.status, 404, "only the business that booked it");
    r = await call("POST", `/advertiser/adverts/${ad.id}/free-month`, { note: "Hardly any taps" }, as(token));
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.advert.booking.freeMonth.state, "asked");
    r = await call("POST", `/advertiser/adverts/${ad.id}/free-month`, {}, as(token));
    assert.equal(r.status, 409, "once only");

    const list = await call("GET", "/admin/adverts?needs=attention", undefined, ADMIN);
    const row = list.data.adverts.find((a: any) => a.id === ad.id);
    assert.ok(row, "it lands in the admin's Needs you list");
    assert.equal(row.freeMonth, "asked");
    assert.equal(row.booking.freeMonth.note, "Hardly any taps");

    const before = loadAdverts().find((a) => a.id === ad.id)!.booking!.paidThrough!;
    r = await call("POST", `/admin/adverts/${ad.id}/free-month`, { grant: true }, ADMIN);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const after = loadAdverts().find((a) => a.id === ad.id)!;
    assert.equal(after.booking!.paidThrough, addMonths(before, 1));
    assert.equal(after.endsAt, after.booking!.paidThrough);
    r = await call("POST", `/admin/adverts/${ad.id}/free-month`, { grant: true }, ADMIN);
    assert.equal(r.status, 409, "never twice");

    const me = await call("GET", "/advertiser/me", undefined, as(token));
    assert.equal(me.data.adverts.find((a: any) => a.id === ad.id).booking.freeMonth.state, "granted");
  });

  test("paid by card: one month's credit goes on its Stripe customer, once, and a failure changes nothing", async () => {
    const email = `card-${Date.now()}@example.com`;
    const token = signIn(email);
    const { account } = findOrCreateAccount(email, undefined);
    const ad = portalAd({ ownerAccountId: account.id, title: "Card shop" });
    ad.booking!.firstPaidAt = ago(35);
    ad.booking!.stripe = { customerId: "cus_123", subscriptionId: "sub_123" };
    saveAdverts([...loadAdverts(), ad]);
    const paidThrough = ad.booking!.paidThrough;
    await call("POST", `/advertiser/adverts/${ad.id}/free-month`, {}, as(token));

    const real = billing.creditNextMonth;
    const credits: unknown[][] = [];
    try {
      billing.creditNextMonth = async () => {
        throw new Error("stripe down");
      };
      const r = await call("POST", `/admin/adverts/${ad.id}/free-month`, { grant: true }, ADMIN);
      assert.equal(r.status, 502);
      assert.equal(freeMonthState(loadAdverts().find((a) => a.id === ad.id)!).state, "asked", "still waiting, so it can be tried again");

      // As slow as a real call to Stripe, so two clicks really do overlap.
      billing.creditNextMonth = async (...args: unknown[]) => {
        credits.push(args);
        await new Promise((ok) => setTimeout(ok, 150));
      };
      const [a, b] = await Promise.all([
        call("POST", `/admin/adverts/${ad.id}/free-month`, { grant: true }, ADMIN),
        call("POST", `/admin/adverts/${ad.id}/free-month`, { grant: true }, ADMIN),
      ]);
      assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    } finally {
      billing.creditNextMonth = real;
    }
    assert.equal(credits.length, 1, "a double click adds one month, not two");
    assert.deepEqual(credits[0].slice(0, 2), ["cus_123", 9900]);
    // Its paid time moves on when Stripe says the (credit-paid) invoice is paid, not now.
    assert.equal(loadAdverts().find((a) => a.id === ad.id)!.booking!.paidThrough, paidThrough);
  });

  test("a person can say no, with a reason the business sees", async () => {
    const email = `no-${Date.now()}@example.com`;
    const token = signIn(email);
    const { account } = findOrCreateAccount(email, undefined);
    const ad = portalAd({ ownerAccountId: account.id });
    ad.booking!.firstPaidAt = ago(35);
    saveAdverts([...loadAdverts(), ad]);
    await call("POST", `/advertiser/adverts/${ad.id}/free-month`, {}, as(token));
    let r = await call("POST", `/admin/adverts/${ad.id}/free-month`, { grant: false }, ADMIN);
    assert.equal(r.status, 400, "a no needs a reason");
    r = await call("POST", `/admin/adverts/${ad.id}/free-month`, { grant: false, reason: "It was paused by reports for most of the month." }, ADMIN);
    assert.equal(r.status, 200);
    const me = await call("GET", "/advertiser/me", undefined, as(token));
    const fm = me.data.adverts.find((a: any) => a.id === ad.id).booking.freeMonth;
    assert.equal(fm.state, "declined");
    assert.match(fm.reason, /paused by reports/);
  });
});

describe("before a booked advert stops", () => {
  const DAY = 86400e3;
  const inDays = (d: number) => new Date(Date.now() + d * DAY).toISOString();
  const booking = (over: Record<string, unknown>) => ({ ...portalAd().booking!, ...over });

  test("invoice payers a week before, cancelled ones too, card payers never, and each only once", async () => {
    const invoiceSoon = portalAd({ booking: booking({ paidThrough: inDays(5) }) });
    const invoiceLater = portalAd({ booking: booking({ paidThrough: inDays(10) }) });
    const cardSoon = portalAd({ booking: booking({ paidThrough: inDays(5), stripe: { subscriptionId: "sub_x" } }) });
    const cancelledSoon = portalAd({ booking: booking({ paidThrough: inDays(3), status: "cancelling", stripe: { subscriptionId: "sub_y" } }) });
    const alreadyTold = portalAd({ booking: booking({ paidThrough: inDays(4) }) });
    alreadyTold.booking!.reminderSentFor = alreadyTold.booking!.paidThrough;
    const over = portalAd({ booking: booking({ paidThrough: inDays(-1) }) });
    const paused = portalAd({ approved: false, booking: booking({ paidThrough: inDays(5) }) });

    const due = dueReminders([invoiceSoon, invoiceLater, cardSoon, cancelledSoon, alreadyTold, over, paused]);
    assert.deepEqual(
      due.map((d) => [d.ad.id, d.kind]),
      [
        [invoiceSoon.id, "renew"],
        [cancelledSoon.id, "ending"],
      ]
    );

    // Sent once: the second run finds nothing.
    saveAdverts([...loadAdverts(), invoiceSoon, cancelledSoon]);
    assert.equal(await runAdvertReminders(), 2);
    assert.equal(await runAdvertReminders(), 0);
    assert.equal(loadAdverts().find((a) => a.id === invoiceSoon.id)!.booking!.reminderSentFor, invoiceSoon.booking!.paidThrough);

    // Paid for another month: the next month's reminder is due in its turn.
    const renewed = loadAdverts();
    const again = renewed.find((a) => a.id === invoiceSoon.id)!;
    again.booking!.paidThrough = inDays(6);
    saveAdverts(renewed);
    assert.equal(dueReminders(loadAdverts()).filter((d) => d.ad.id === invoiceSoon.id).length, 1);
  });

  test("an invoice payer can ask for next month's invoice once; a card payer or another business can't", async () => {
    const email = `renew-${Date.now()}@example.com`;
    const token = signIn(email);
    const { account } = findOrCreateAccount(email, undefined);
    const other = signIn(`other-${Date.now()}@example.com`);
    const invoiceAd = portalAd({ ownerAccountId: account.id, booking: booking({ paidThrough: inDays(5) }) });
    const cardAd = portalAd({ ownerAccountId: account.id, booking: booking({ paidThrough: inDays(5), stripe: { subscriptionId: "sub_z" } }) });
    saveAdverts([...loadAdverts(), invoiceAd, cardAd]);

    assert.equal((await call("POST", `/advertiser/adverts/${invoiceAd.id}/renew-invoice`, {}, as(other))).status, 404);
    const r = await call("POST", `/advertiser/adverts/${invoiceAd.id}/renew-invoice`, {}, as(token));
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.advert.booking.invoiceRequested, true);
    assert.equal((await call("POST", `/advertiser/adverts/${invoiceAd.id}/renew-invoice`, {}, as(token))).status, 409);
    assert.equal((await call("POST", `/advertiser/adverts/${cardAd.id}/renew-invoice`, {}, as(token))).status, 409);

    // Marked paid on the admin page: a month more, and the request is cleared.
    const paid = await call("POST", `/admin/adverts/${invoiceAd.id}/mark-paid`, { months: 1 }, ADMIN);
    assert.equal(paid.status, 200, JSON.stringify(paid.data));
    const after = loadAdverts().find((a) => a.id === invoiceAd.id)!;
    assert.equal(after.booking!.invoiceRequested, false);
    assert.ok(new Date(after.booking!.paidThrough!).getTime() > Date.now() + 30 * DAY);
  });
});
