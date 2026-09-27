import express, { Express, Request, Response } from "express";
import { Advert, loadAdverts, saveAdverts } from "../utils/advertStore";
import { accountById } from "../utils/accountStore";
import { advertEmails } from "../utils/advertEmails";
import { verifyStripeSignature } from "../utils/advertBilling";

/**
 * Stripe tells us about advert payments here.
 *
 *   POST /webhooks/stripe
 *
 * In the Stripe dashboard (Developers, Webhooks) add this address and pick the events
 * checkout.session.completed, invoice.paid, invoice.payment_failed,
 * customer.subscription.updated and customer.subscription.deleted, then put its signing secret in
 * STRIPE_WEBHOOK_SECRET. Without that setting the route does not exist (404), and anything not
 * signed by Stripe is refused (400), so nobody can fake a payment.
 *
 * It must see the body exactly as Stripe sent it to check the signature, so it is registered
 * before the JSON parser (see server.ts).
 */

type Change = { ad: Advert; email?: "live" | "payment-failed" | "ended" };

const ms = (s: number) => new Date(s * 1000).toISOString();

function findAd(all: Advert[], ids: { advertId?: string | null; subscriptionId?: string | null }): Advert | undefined {
  return (
    (ids.advertId ? all.find((a) => a.id === ids.advertId && a.booking) : undefined) ??
    (ids.subscriptionId ? all.find((a) => a.booking?.stripe?.subscriptionId === ids.subscriptionId) : undefined)
  );
}

/**
 * What one Stripe event changes, applied to the adverts in memory. Returns the advert it changed
 * (and which email to send), or null for anything we don't act on. Exported for the tests.
 */
export function applyStripeEvent(event: any, all: Advert[], now = new Date()): Change | null {
  const obj = event?.data?.object ?? {};
  switch (event?.type) {
    case "checkout.session.completed": {
      const ad = findAd(all, { advertId: obj.metadata?.advertId ?? obj.client_reference_id });
      if (!ad || !ad.booking) return null;
      ad.booking.stripe = { ...(ad.booking.stripe ?? {}), customerId: obj.customer ?? null, subscriptionId: obj.subscription ?? null, checkoutSessionId: obj.id ?? null };
      if (ad.booking.status === "awaiting-payment") {
        ad.booking.status = "active";
        ad.booking.holdUntil = null;
        ad.booking.invoiceRequested = false;
        // It can't start before it was paid for.
        if (new Date(ad.startsAt).getTime() < now.getTime()) ad.startsAt = now.toISOString();
      }
      return { ad };
    }
    case "invoice.paid": {
      const subscriptionId = obj.subscription ?? obj.parent?.subscription_details?.subscription ?? null;
      const advertId = obj.subscription_details?.metadata?.advertId ?? obj.parent?.subscription_details?.metadata?.advertId ?? obj.lines?.data?.[0]?.metadata?.advertId ?? null;
      const ad = findAd(all, { advertId, subscriptionId });
      if (!ad || !ad.booking) return null;
      // The £0 invoice at the start of a trial pays for nothing.
      if (!(Number(obj.amount_paid) > 0) && !(Number(obj.total) > 0)) return null;
      const periodEnd = Math.max(...(obj.lines?.data ?? []).map((l: any) => Number(l?.period?.end) || 0), Number(obj.period_end) || 0);
      if (!periodEnd) return null;
      const first = !ad.booking.paidAt;
      ad.booking.paidAt = now.toISOString();
      ad.booking.paidThrough = ms(periodEnd);
      if (ad.booking.status === "awaiting-payment") ad.booking.status = "active";
      if (subscriptionId) ad.booking.stripe = { ...(ad.booking.stripe ?? {}), subscriptionId };
      ad.endsAt = ad.booking.paidThrough;
      if (new Date(ad.startsAt).getTime() > now.getTime() + 60_000 && first) {
        // Paid now for a later start: it still starts on its own date.
      } else if (first && new Date(ad.startsAt).getTime() < now.getTime()) {
        ad.startsAt = now.toISOString();
      }
      if (!ad.booking.firstPaidAt) ad.booking.firstPaidAt = new Date(Math.max(new Date(ad.startsAt).getTime(), now.getTime())).toISOString();
      return { ad, email: first ? "live" : undefined };
    }
    case "invoice.payment_failed": {
      const ad = findAd(all, { subscriptionId: obj.subscription ?? obj.parent?.subscription_details?.subscription ?? null });
      return ad ? { ad, email: "payment-failed" } : null;
    }
    case "customer.subscription.updated": {
      const ad = findAd(all, { advertId: obj.metadata?.advertId, subscriptionId: obj.id });
      if (!ad || !ad.booking || !["active", "cancelling"].includes(ad.booking.status)) return null;
      ad.booking.status = obj.cancel_at_period_end ? "cancelling" : "active";
      if (obj.cancel_at_period_end && ad.booking.paidThrough) ad.endsAt = ad.booking.paidThrough;
      return { ad };
    }
    case "customer.subscription.deleted": {
      const ad = findAd(all, { advertId: obj.metadata?.advertId, subscriptionId: obj.id });
      if (!ad || !ad.booking) return null;
      ad.booking.status = "ended";
      // Whatever was paid for still runs to its end; nothing more.
      const paidEnd = ad.booking.paidThrough ? new Date(ad.booking.paidThrough).getTime() : now.getTime();
      ad.endsAt = new Date(Math.min(new Date(ad.endsAt).getTime(), Math.max(paidEnd, now.getTime()))).toISOString();
      return { ad, email: "ended" };
    }
    default:
      return null;
  }
}

export default function registerStripeWebhook(app: Express) {
  app.post("/webhooks/stripe", express.raw({ type: "*/*", limit: "1mb" }), (req: Request, res: Response) => {
    const secret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
    if (!secret) return res.status(404).json({ ok: false, error: "Not found" });
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    if (!verifyStripeSignature(raw, req.headers["stripe-signature"], secret)) {
      return res.status(400).json({ ok: false, error: "Bad signature" });
    }
    let event: any;
    try {
      event = JSON.parse(raw.toString("utf8"));
    } catch {
      return res.status(400).json({ ok: false, error: "Bad body" });
    }
    try {
      const all = loadAdverts();
      const change = applyStripeEvent(event, all);
      if (change) {
        saveAdverts(all);
        const email = change.ad.ownerAccountId ? accountById(change.ad.ownerAccountId)?.email : null;
        if (email && change.email === "live") void advertEmails.live(change.ad, email).catch(() => {});
        if (email && change.email === "payment-failed") void advertEmails.paymentFailed(change.ad, email).catch(() => {});
        if (email && change.email === "ended") void advertEmails.ended(change.ad, email).catch(() => {});
      }
      // A 200 for everything we've handled or chose to ignore, so Stripe doesn't send it again.
      res.json({ received: true });
    } catch (err: any) {
      console.error("stripe webhook failed:", err?.message ?? err);
      // Stripe tries again later.
      res.status(500).json({ ok: false });
    }
  });
}
