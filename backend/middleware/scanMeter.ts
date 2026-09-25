import type { NextFunction, Request, Response } from "express";
import { isProSubscriber } from "../subscriptions/revenueCat";
import { freeScanCapEnabled, freeScanStatus, returnFreeScan, takeFreeScan } from "./freeScanLimit";
import { getBalance, refund, spend } from "../utils/creditStore";

/**
 * What a lookup (barcode, photo or search) costs the person, in this order:
 *
 *   1. one of their 5 free scans this week (counted per phone, no account needed);
 *   2. otherwise, if they are a paying Pro subscriber, nothing;
 *   3. otherwise one scan credit from their account (they must be signed in);
 *   4. otherwise the lookup is refused, and the reply says which of "sign in" or "buy credits" fits.
 *
 * The scan is paid for when it starts and PAID BACK if it then fails, so a lookup that returns no
 * result never costs anyone anything. A person who cancels on their own phone before the answer
 * arrives is not refunded: the lookup ran and cost us the same.
 *
 * Off in development (see freeScanCapEnabled) so testing on your own machine never runs out.
 */

export const callerDevice = (req: Request): string | null => {
  const header = req.headers["x-device-id"];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const raw =
    typeof req.query.deviceId === "string"
      ? req.query.deviceId
      : typeof req.body?.deviceId === "string"
      ? req.body.deviceId
      : fromHeader;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
};

/** Pays the person's cost back when the reply turns out to be a failure. */
function payBackOnFailure(res: Response, undo: () => void) {
  let failed = false;
  const json = res.json.bind(res);
  res.json = ((body: any) => {
    // The lookups report a failed lookup as { error: "..." } (usually with status 200).
    if (body && typeof body === "object" && typeof body.error === "string") failed = true;
    return json(body);
  }) as typeof res.json;

  res.on("finish", () => {
    if (failed || res.statusCode >= 400) undo();
  });
}

export async function scanMeter(req: Request, res: Response, next: NextFunction) {
  if (!freeScanCapEnabled()) return next();

  const deviceId = callerDevice(req);
  // Without a device id there is no way to tell whose scans these are, so it can't be let through.
  if (!deviceId) {
    res.status(400).json({
      error: "missing-device",
      message: "Something went wrong identifying your phone. Please update the app and try again.",
    });
    return;
  }

  if (takeFreeScan(deviceId)) {
    payBackOnFailure(res, () => returnFreeScan(deviceId));
    return next();
  }

  // Only worth the extra round trip once the free scans are gone.
  if (await isProSubscriber(deviceId)) return next();

  const free = freeScanStatus(deviceId);
  const account = req.account;

  if (account) {
    if (spend(account.id, 1, "scan").ok) {
      payBackOnFailure(res, () => {
        refund(account.id, 1, "scan-refund");
      });
      return next();
    }
    res.json({
      error: "out-of-credits",
      message: `You've used your ${free.limit} free scans this week and have no scan credits left. Get more credits, or your free scans come back on ${free.resetsOn}.`,
      resetsOn: free.resetsOn,
      signedIn: true,
      credits: getBalance(account.id),
    });
    return;
  }

  res.json({
    error: "free-scan-limit",
    message: `You've used your ${free.limit} free scans this week. Sign in to use scan credits, or your free scans come back on ${free.resetsOn}.`,
    resetsOn: free.resetsOn,
    signedIn: false,
    credits: 0,
  });
}
