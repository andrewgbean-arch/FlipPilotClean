import crypto from "crypto";
import { Express, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import { CREDIT_PACKS } from "../utils/creditPacks";
import { accountOwningDevice } from "../utils/accountStore";
import { reverseRefundedPurchase } from "../utils/creditStore";

/**
 * RevenueCat tells us when the App Store or Google Play refunds a purchase.
 *
 *   POST /webhooks/revenuecat
 *
 * In the RevenueCat dashboard (Integrations, Webhooks) set the URL to this route and the "Authorization
 * header value" to REVENUECAT_WEBHOOK_SECRET. Without that secret set here the route does not exist (404),
 * and without the right header it refuses (401), so nobody else can send a fake refund.
 *
 * A refunded one-time purchase arrives as a CANCELLATION event whose cancel_reason is CUSTOMER_SUPPORT.
 * If it is one of our credit packs the credits it paid for are taken back (the balance can then be
 * negative behind the scenes; the person sees 0 and their next purchase pays it off). Everything else is
 * acknowledged and ignored. RevenueCat needs a 200 for anything it should not send again.
 */

function secret(): string | null {
  const s = (process.env.REVENUECAT_WEBHOOK_SECRET ?? "").trim();
  return s.length >= 24 ? s : null;
}

function authorised(req: Request, wanted: string): boolean {
  const header = req.headers.authorization;
  const given = String(Array.isArray(header) ? header[0] : header ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(wanted);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default function registerWebhookRoutes(app: Express) {
  app.post("/webhooks/revenuecat", rateLimit(300), (req: Request, res: Response) => {
    const wanted = secret();
    if (!wanted) return res.status(404).json({ ok: false, error: "Not found" });
    if (!authorised(req, wanted)) return res.status(401).json({ ok: false, error: "Bad webhook secret" });

    const event = req.body?.event;
    if (!event || typeof event !== "object") return res.status(400).json({ ok: false, error: "No event" });

    const isRefund = event.type === "CANCELLATION" && event.cancel_reason === "CUSTOMER_SUPPORT";
    const credits = typeof event.product_id === "string" ? CREDIT_PACKS[event.product_id] : undefined;
    const txn = typeof event.transaction_id === "string" ? event.transaction_id.slice(0, 200) : "";
    if (!isRefund || !credits || !txn) return res.json({ ok: true, handled: "ignored" });

    // The person is known to RevenueCat by the id the app gave it (the account's own device id), or an earlier one.
    const ids: unknown[] = [event.app_user_id, event.original_app_user_id, ...(Array.isArray(event.aliases) ? event.aliases : [])];
    let account = null;
    for (const id of ids) {
      if (typeof id === "string") {
        account = accountOwningDevice(id);
        if (account) break;
      }
    }

    try {
      const result = reverseRefundedPurchase(txn, account?.id ?? null, credits);
      res.json({ ok: true, handled: result.status, taken: result.taken });
    } catch (err: any) {
      // A 500 makes RevenueCat try again later, which is what we want if the file could not be read.
      console.error("refund could not be applied:", err?.message);
      res.status(500).json({ ok: false, error: "server" });
    }
  });
}
