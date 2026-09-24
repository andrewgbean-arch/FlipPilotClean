import type { NextFunction, Request, Response } from "express";
import { Account, accountForToken, accountOwningDevice } from "../utils/accountStore";

/**
 * Who is asking, and whether they may act as the id they name.
 *
 * Two pieces:
 *
 * accountGuard  (runs on every request) reads the session token, if there is one, and puts the
 *   account on the request. Then, if the request names a device id that BELONGS to an account
 *   (in the x-device-id header, the body or the query) it must carry that account's token.
 *   Knowing someone's id is therefore no longer enough to act as them, or to read their private
 *   pages. Ids that belong to nobody keep working, so browsing needs no sign-in.
 *
 * requireAccount  (put on the routes that need a real person: selling, messaging, reviewing,
 *   reporting) refuses anyone who isn't signed in, and anyone naming a different id from the one
 *   their account owns. It is ON in production and OFF in development so the app can be tried
 *   without email; REQUIRE_ACCOUNT=on or off overrides.
 */

declare module "express-serve-static-core" {
  interface Request {
    account?: Account | null;
  }
}

/** Public pages that only use a device id to tailor what is shown; they never need the token. */
const PUBLIC_READS = ["/published-listings", "/adverts", "/marketplace/policy", "/fairs", "/sellers", "/listings", "/uploads", "/health"];

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  const value = Array.isArray(h) ? h[0] : h;
  const m = typeof value === "string" ? value.match(/^Bearer\s+(\S+)$/i) : null;
  return m ? m[1] : null;
}

/** Every device id the request names, wherever it put it. */
function namedIds(req: Request): string[] {
  const out: string[] = [];
  const header = req.headers["x-device-id"];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  if (typeof fromHeader === "string" && fromHeader.trim()) out.push(fromHeader.trim());
  if (typeof req.body?.deviceId === "string" && req.body.deviceId.trim()) out.push(req.body.deviceId.trim());
  if (typeof req.query?.deviceId === "string" && req.query.deviceId.trim()) out.push(req.query.deviceId.trim());
  return out;
}

export function accountRequired(): boolean {
  const setting = (process.env.REQUIRE_ACCOUNT ?? "").trim().toLowerCase();
  if (setting === "on") return true;
  if (setting === "off") return false;
  return process.env.NODE_ENV === "production";
}

export function accountGuard(req: Request, res: Response, next: NextFunction) {
  req.account = accountForToken(bearer(req));

  // Signing in is how a session is got in the first place, so it must never need one.
  if (req.path.toLowerCase().startsWith("/auth/")) return next();

  // Public pages that merely personalise by id never ask for the token.
  const path = req.path.toLowerCase();
  const publicRead = req.method === "GET" && PUBLIC_READS.some((p) => path === p || path.startsWith(p + "/")) && !path.endsWith("/review-status");
  if (publicRead) return next();

  for (const id of namedIds(req)) {
    const owner = accountOwningDevice(id);
    if (owner && owner.id !== req.account?.id) {
      return res.status(401).json({
        ok: false,
        error: "sign-in-required",
        message: "Please sign in again to continue.",
      });
    }
  }
  next();
}

export function requireAccount(req: Request, res: Response, next: NextFunction) {
  if (!accountRequired()) return next();

  if (!req.account) {
    return res.status(401).json({
      ok: false,
      error: "sign-in-required",
      message: "Please sign in with your email to do this.",
    });
  }
  // Act as the id the account owns, and no other.
  const named = namedIds(req);
  if (named.some((id) => id !== req.account!.canonicalDeviceId)) {
    return res.status(403).json({
      ok: false,
      error: "identity-mismatch",
      message: "This phone needs to sign in again.",
    });
  }
  next();
}
