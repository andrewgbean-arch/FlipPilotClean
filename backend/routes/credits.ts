import { Express, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import { adminOk } from "../utils/adminAuth";
import { accountByEmail } from "../utils/accountStore";
import { creditsFor, grant, MAX_GRANT } from "../utils/creditStore";
import { freeScanCapEnabled, freeScanStatus } from "../middleware/freeScanLimit";

/**
 * Scan credits.
 *
 *   GET  /credits                 this person's free scans left this week and their credit balance
 *   GET  /admin/credits?email=    an account's balance and history          (ADMIN_TOKEN)
 *   POST /admin/credits/grant     give credits, for support or a gift       (ADMIN_TOKEN)
 *
 * Buying credits arrives later, through the app stores, and will use the same grant() so a
 * purchase reported twice only pays out once.
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
    });
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
