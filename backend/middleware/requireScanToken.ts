import type { NextFunction, Request, Response } from "express";
import { freeScanCapEnabled } from "./freeScanLimit";
import { callerDevice } from "./scanMeter";
import { checkScanToken, deviceOfScanToken, useScanToken, type ScanTokenResult } from "../utils/scanToken";

/**
 * The price step of a scan needs proof that a real scan came first (see utils/scanToken.ts). Off in development
 * with the rest of the metering, so testing on your own computer is not held up.
 *
 * A refusal is an ordinary 200 with an { error, message }, the same shape the other lookups use. The app turns
 * the message into words on the result screen (see recheckPrice in app/scan/scan-results.tsx).
 *
 * Two halves, with the server-wide daily lookup budget between them (see routes/scanSteps.ts):
 *   requireScanToken  looks at the token and refuses a bad one, counting nothing, BEFORE the budget is touched,
 *                     so requests with no valid token cannot use up the day's budget;
 *   spendScanToken    counts the use, AFTER the budget has let the request through, so a request the budget
 *                     refused never costs a customer one of their rechecks.
 */
const MESSAGES: Record<string, string> = {
  missing: "Please scan the item again to get its prices.",
  invalid: "Please scan the item again to get its prices.",
  "wrong-phone": "Please scan the item again to get its prices.",
  expired: "That scan has run out. Scan the item again to get its prices.",
  "used-up": "You've checked this scan a lot of times. Scan the item again to check more prices.",
  "other-item": "That scan was for a different item. Scan this item to get its prices.",
};

function who(req: Request): { token: unknown; deviceId: string | null } {
  const header = req.headers["x-scan-token"];
  const token = req.body?.scanToken ?? (Array.isArray(header) ? header[0] : header);
  // Older app builds send no phone id with the price request; the signed token says which phone it was made for.
  return { token, deviceId: callerDevice(req) ?? deviceOfScanToken(token) };
}

function refuse(res: Response, result: Extract<ScanTokenResult, { ok: false }>) {
  res.json({ error: "scan-required", reason: result.reason, message: MESSAGES[result.reason] ?? MESSAGES.invalid });
}

const noPhone = (res: Response) =>
  res.status(400).json({
    error: "missing-device",
    message: "Something went wrong identifying your phone. Please update the app and try again.",
  });

export function requireScanToken(req: Request, res: Response, next: NextFunction) {
  if (!freeScanCapEnabled()) return next();
  const { token, deviceId } = who(req);
  if (!deviceId) return noPhone(res);
  const result = checkScanToken(token, deviceId, Date.now(), req.body?.title);
  if (result.ok) return next();
  refuse(res, result);
}

export function spendScanToken(req: Request, res: Response, next: NextFunction) {
  if (!freeScanCapEnabled()) return next();
  const { token, deviceId } = who(req);
  if (!deviceId) return noPhone(res);
  const result = useScanToken(token, deviceId, Date.now(), req.body?.title);
  if (result.ok) return next();
  refuse(res, result);
}
