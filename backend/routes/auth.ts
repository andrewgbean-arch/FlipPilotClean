import { Express, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import {
  accountByEmail,
  cancelIssuedCode,
  checkCode,
  createSession,
  deleteAccount,
  findOrCreateAccount,
  issueCode,
  normaliseEmail,
  revokeSession,
} from "../utils/accountStore";
import { sendLoginCode } from "../utils/mailer";
import { checkReviewCode, isReviewEmail } from "../utils/reviewAccount";
import { deleteUserData } from "../utils/userData";
import { networkOf } from "../utils/clientAddress";
import { returnSignupAllowance, signupAllowanceLeft, takeSignupAllowance } from "../utils/signupLimit";

/**
 * Sign in with an email address and a one-time code. No passwords.
 *
 *   POST /auth/request-code  { email }                      sends a 6-digit code
 *   POST /auth/verify        { email, code, deviceId }      returns a session token and the id to use
 *   GET  /auth/me                                            who am I
 *   POST /auth/logout                                        end this session
 *   POST /auth/delete-account { confirm: "DELETE" }          erase the account and its data
 *
 * Asking for a code says the same thing whether or not the email already has an account, so this
 * can't be used to find out who has one.
 */

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  const value = Array.isArray(h) ? h[0] : h;
  const m = typeof value === "string" ? value.match(/^Bearer\s+(\S+)$/i) : null;
  return m ? m[1] : null;
}

// Test-only: hand the code back in the reply so it can be exercised without reading an inbox.
// Never in production, whatever else is set.
const devEcho = () => process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_ECHO === "1";

export default function registerAuthRoutes(app: Express) {
  app.post("/auth/request-code", rateLimit(10), async (req: Request, res: Response) => {
    const email = normaliseEmail(req.body?.email);
    if (!email) return res.status(400).json({ ok: false, error: "bad-email", message: "Enter a valid email address." });

    // Google Play's reviewers sign in with a fixed code (see utils/reviewAccount.ts): nothing is emailed, so there
    // is nothing to send and nothing to count against the network.
    if (isReviewEmail(email)) return res.json({ ok: true });

    // Each email costs us something and every new address is a fresh start for a script, so one network
    // may only ask for so many codes a day (see utils/signupLimit.ts).
    const network = networkOf(req.ip);
    if (!takeSignupAllowance("codes", network)) {
      return res.status(429).json({
        ok: false,
        error: "network-limit",
        message: "Too many sign-in codes have been asked for from this connection today. Please try again tomorrow, or from a different connection.",
      });
    }

    const issued = issueCode(email);
    if ("error" in issued) {
      returnSignupAllowance("codes", network); // nothing was sent
      return res.status(429).json({
        ok: false,
        error: issued.error === "wait" ? "wait" : "too-many",
        message:
          issued.error === "wait"
            ? "A code was only just sent. Give it a moment, then check your email (and your junk folder)."
            : "That's a lot of codes. Please try again in an hour.",
      });
    }

    try {
      await sendLoginCode(email, issued.code);
    } catch (err: any) {
      console.error("sending a sign-in code failed:", err?.message ?? err);
      cancelIssuedCode(email);
      returnSignupAllowance("codes", network); // nothing was sent
      return res.status(503).json({ ok: false, error: "email-unavailable", message: "We couldn't send the code just now. Please try again in a few minutes." });
    }
    res.json({ ok: true, ...(devEcho() ? { devCode: issued.code } : {}) });
  });

  app.post("/auth/verify", rateLimit(10), (req: Request, res: Response) => {
    const email = normaliseEmail(req.body?.email);
    if (!email) return res.status(400).json({ ok: false, error: "bad-email", message: "Enter a valid email address." });

    // The reviewers' account is made once and is not one of the network's sign-ups, so it neither uses up the
    // daily allowance of new accounts nor is turned away by it.
    const review = isReviewEmail(email);

    // A brand-new account is a fresh set of free scans, so one network may only make so many a day. Checked
    // BEFORE the code, so a person turned away here has not used up their code and can use it elsewhere.
    const network = networkOf(req.ip);
    if (!review && !accountByEmail(email) && signupAllowanceLeft("accounts", network) <= 0) {
      return res.status(429).json({
        ok: false,
        error: "network-limit",
        message: "Too many new accounts have been made from this connection today. Please try again tomorrow, or from a different connection.",
      });
    }

    const result = review ? checkReviewCode(req.body?.code) : checkCode(email, req.body?.code);
    if (review) console.log(result.ok ? "[review] the review account signed in" : `[review] a wrong code was tried on the review account (${result.reason})`);
    if (!result.ok) {
      const messages = {
        wrong: "That code isn't right.",
        expired: "That code has run out. Ask for a new one.",
        // A new code would not help the reviewers: their code is fixed, and it is the wait that opens it again.
        locked: review ? "Too many wrong tries. Please wait half an hour and try again." : "Too many wrong tries. Ask for a new code.",
      } as const;
      return res.status(400).json({
        ok: false,
        error: result.reason === "wrong" ? "wrong-code" : result.reason === "expired" ? "code-expired" : "code-locked",
        message: messages[result.reason],
        ...(result.attemptsLeft !== undefined ? { attemptsLeft: result.attemptsLeft } : {}),
      });
    }

    const { account, isNew } = findOrCreateAccount(email, req.body?.deviceId);
    if (isNew && !review) takeSignupAllowance("accounts", network);
    const token = createSession(account.id);
    res.json({
      ok: true,
      token,
      isNew,
      email: account.email,
      // The id this phone must use from now on: the account's own.
      deviceId: account.canonicalDeviceId,
    });
  });

  app.get("/auth/me", rateLimit(60), (req: Request, res: Response) => {
    if (!req.account) return res.status(401).json({ ok: false, error: "sign-in-required" });
    res.json({ ok: true, email: req.account.email, deviceId: req.account.canonicalDeviceId, createdAt: req.account.createdAt });
  });

  app.post("/auth/logout", rateLimit(20), (req: Request, res: Response) => {
    const token = bearer(req);
    if (token) revokeSession(token);
    res.json({ ok: true });
  });

  // Erases everything: the account, its sessions, and the person's listings, messages and photos.
  app.post("/auth/delete-account", rateLimit(5), (req: Request, res: Response) => {
    if (!req.account) return res.status(401).json({ ok: false, error: "sign-in-required" });
    if (req.body?.confirm !== "DELETE") {
      return res.status(400).json({ ok: false, error: 'Send { "confirm": "DELETE" } to confirm' });
    }
    const removed = deleteUserData(req.account.canonicalDeviceId);
    deleteAccount(req.account.id);
    res.json({ ok: true, removed });
  });
}
