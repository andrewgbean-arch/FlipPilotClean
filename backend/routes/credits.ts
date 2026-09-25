import { Express, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import { adminOk } from "../utils/adminAuth";
import { accountByEmail } from "../utils/accountStore";
import { creditsFor, grant, MAX_GRANT } from "../utils/creditStore";
import { freeScanCapEnabled, freeScanStatus } from "../middleware/freeScanLimit";
import { CREDIT_PACKS, creditPackList } from "../utils/creditPacks";
import { fetchOneTimePurchases, revenueCatConfigured } from "../subscriptions/revenueCat";

/**
 * Scan credits.
 *
 *   GET  /credits                 this person's free scans left this week, their credit balance, and the packs on sale
 *   POST /credits/claim           turn the account's paid-for packs into credits (safe to call as often as you like)
 *   GET  /admin/credits?email=    an account's balance and history          (ADMIN_TOKEN)
 *   POST /admin/credits/grant     give credits, for support or a gift       (ADMIN_TOKEN)
 *
 * Buying happens in the app through RevenueCat. The phone then calls /credits/claim, and the server
 * asks RevenueCat itself what the account has bought and grants credits once per purchase id.
 */

const deviceOf = (req: Request): string | null => {
  const header = req.headers["x-device-id"];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const raw = typeof req.query.deviceId === "string" ? req.query.deviceId : fromHeader;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
};

export default function registerCreditsRoutes(app: Express) {
  app.get("/credits", rateLimit(60), (req: Request, res: Response) => {
    const deviceId = deviceOf(req);
    const free = deviceId ? freeScanStatus(deviceId) : null;
    res.json({
      ok: true,
      // When this is false the limits are not being applied (development), so the app shouldn't nag.
      metering: freeScanCapEnabled(),
      signedIn: !!req.account,
      credits: req.account ? creditsFor(req.account.id)?.balance ?? 0 : 0,
      free: free ? { limit: free.limit, left: free.left, resetsOn: free.resetsOn } : null,
      packs: creditPackList(),
    });
  });

  // Credits are granted from what RevenueCat says this account has bought, never from what the
  // phone says. Each purchase has its own id and is only ever paid out once, so claiming again,
  // or from two places at once, is harmless.
  app.post("/credits/claim", rateLimit(20), async (req: Request, res: Response) => {
    const account = req.account;
    if (!account) {
      return res.status(401).json({ ok: false, error: "sign-in-required", message: "Please sign in to get your credits." });
    }
    if (!revenueCatConfigured()) {
      return res.status(503).json({ ok: false, error: "purchases-unavailable", message: "Buying credits isn't available yet." });
    }

    // RevenueCat knows the person by the id the app gave it: the account's own device id.
    const purchases = await fetchOneTimePurchases(account.canonicalDeviceId);
    if (!purchases) {
      return res.status(502).json({ ok: false, error: "purchases-check-failed", message: "We couldn't check your purchases just now. Please try again in a moment." });
    }

    let granted = 0;
    for (const purchase of purchases) {
      const credits = CREDIT_PACKS[purchase.productId];
      if (!credits) continue; // not a credit pack (for example a boot fair feature)
      const result = grant(account.id, credits, "purchase", `rc:${purchase.id}`);
      if (result.ok && !result.duplicate) granted += credits;
    }
    res.json({ ok: true, granted, credits: creditsFor(account.id)?.balance ?? 0 });
  });

  app.get("/admin/credits", rateLimit(30), (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    const account = accountByEmail(String(req.query.email ?? ""));
    if (!account) return res.status(404).json({ ok: false, error: "No account with that email" });
    res.json({ ok: true, email: account.email, credits: creditsFor(account.id) ?? { balance: 0, ledger: [] } });
  });

  app.post("/admin/credits/grant", rateLimit(30), (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    const account = accountByEmail(String(req.body?.email ?? ""));
    if (!account) return res.status(404).json({ ok: false, error: "No account with that email" });

    const amount = req.body?.amount;
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_GRANT) {
      return res.status(400).json({ ok: false, error: `amount must be a whole number from 1 to ${MAX_GRANT}` });
    }
    const ref = typeof req.body?.ref === "string" && req.body.ref.trim() ? req.body.ref.trim().slice(0, 100) : undefined;
    const result = grant(account.id, amount, "gift", ref);
    res.json({ ok: result.ok, balance: result.balance, duplicate: !!result.duplicate });
  });
}
