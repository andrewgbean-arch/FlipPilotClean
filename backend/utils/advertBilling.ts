import crypto from "crypto";
import axios from "axios";
import type { Advert } from "./advertStore";
import { PLACEMENT_NAMES } from "./advertPricing";
import { portalUrl } from "./advertEmails";

/**
 * Card payments for adverts, through Stripe (https://stripe.com), with Stripe's own web API: no
 * library needed.
 *
 * Settings (all on the server, never in the app):
 *   STRIPE_SECRET_KEY        sk_test_... or sk_live_...   switches card payments on
 *   STRIPE_WEBHOOK_SECRET    whsec_...                    lets Stripe tell us a payment happened
 * Without the key the portal still works: a business asks for an invoice instead, and the adverts
 * admin page marks it paid.
 *
 * Each advert is a monthly subscription at the price it was booked at. The launch offer (half
 * price for the first 2 months) is a Stripe coupon, made the first time it's needed. An advert
 * booked to start later saves the card now and is first charged on its start date (a trial until
 * then). Stripe sends the receipts.
 */

const API = "https://api.stripe.com/v1";
export const LAUNCH_COUPON_ID = "flippilot-ads-launch-half-price";

function key(): string | null {
  const k = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  return /^sk_(test|live)_/.test(k) ? k : null;
}

/** Stripe wants form fields, with nested keys written like line_items[0][price_data][currency]. */
export function formEncode(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") out.push(...formEncode(v as Record<string, unknown>, name));
    else out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

async function stripe<T = any>(method: "GET" | "POST", path: string, body?: Record<string, unknown>): Promise<T> {
  const k = key();
  if (!k) throw new Error("card-payments-off");
  const res = await axios.request<T>({
    method,
    url: `${API}${path}`,
    data: body ? formEncode(body).join("&") : undefined,
    headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15_000,
  });
  return res.data;
}

async function ensureLaunchCoupon(): Promise<void> {
  try {
    await stripe("GET", `/coupons/${LAUNCH_COUPON_ID}`);
  } catch (err: any) {
    if (err?.response?.status !== 404) throw err;
    await stripe("POST", "/coupons", {
      id: LAUNCH_COUPON_ID,
      name: "Launch offer: half price for 2 months",
      percent_off: 50,
      duration: "repeating",
      duration_in_months: 2,
    });
  }
}

/** Where Stripe sends people back to: the portal's own address, never one the browser chose. */
function returnTo(which: "paid" | "cancelled", advertId: string): string {
  return `${portalUrl()}/#/advert/${encodeURIComponent(advertId)}?payment=${which}`;
}

/** What goes to Stripe to start the checkout. Exported so it can be checked without calling Stripe. */
export function checkoutRequest(ad: Advert, email: string, launchCoupon: boolean, now = new Date()) {
  const b = ad.booking!;
  const startsLater = new Date(ad.startsAt).getTime() - now.getTime() > 48 * 3600 * 1000;
  const names = ad.placements.map((p) => PLACEMENT_NAMES[p] ?? p).join(" + ");
  return {
    mode: "subscription",
    customer_email: email,
    client_reference_id: ad.id,
    metadata: { advertId: ad.id },
    line_items: {
      0: {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: b.monthlyPence,
          recurring: { interval: "month" },
          product_data: { name: `FlipPilot advert: ${names}`, description: `"${ad.title}", within ${ad.radiusMiles ?? 50} miles of ${ad.postcode ?? "your business"}` },
        },
      },
    },
    subscription_data: {
      metadata: { advertId: ad.id },
      ...(startsLater ? { trial_end: Math.floor(new Date(ad.startsAt).getTime() / 1000) } : {}),
    },
    ...(launchCoupon ? { discounts: { 0: { coupon: LAUNCH_COUPON_ID } } } : { allow_promotion_codes: "true" }),
    success_url: returnTo("paid", ad.id),
    cancel_url: returnTo("cancelled", ad.id),
  };
}

export const billing = {
  cardPaymentsOn(): boolean {
    return key() !== null;
  },

  async startCheckout(ad: Advert, email: string, _returnUrl: string): Promise<{ id: string; url: string }> {
    const launch = !!ad.booking?.launchMonthlyPence && (ad.booking?.launchMonths ?? 0) > 0;
    if (launch) await ensureLaunchCoupon();
    const session = await stripe<{ id: string; url: string }>("POST", "/checkout/sessions", checkoutRequest(ad, email, launch));
    return { id: session.id, url: session.url };
  },

  async cancelAtPeriodEnd(subscriptionId: string): Promise<void> {
    await stripe("POST", `/subscriptions/${encodeURIComponent(subscriptionId)}`, { cancel_at_period_end: "true" });
  },
};

/**
 * Is this really from Stripe? The Stripe-Signature header carries a time and an HMAC-SHA256 of
 * "time.body" made with the webhook secret. Anything else, or anything older than 5 minutes (a
 * replay), is refused.
 */
export function verifyStripeSignature(rawBody: Buffer, header: unknown, secret: string, now = Date.now()): boolean {
  if (typeof header !== "string") return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    })
  ) as Record<string, string>;
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > 300) return false;
  const wanted = crypto.createHmac("sha256", secret).update(`${t}.${rawBody.toString("utf8")}`).digest("hex");
  const given = header
    .split(",")
    .filter((p) => p.trim().startsWith("v1="))
    .map((p) => p.trim().slice(3));
  return given.some((g) => g.length === wanted.length && crypto.timingSafeEqual(Buffer.from(g), Buffer.from(wanted)));
}
