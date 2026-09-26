import type { NextFunction, Request, Response } from "express";
import { freeScanCapEnabled } from "./freeScanLimit";
import { callerDevice } from "./scanMeter";
import { deviceOfScanToken, useScanToken } from "../utils/scanToken";

/**
 * The price step of a scan needs proof that a real scan came first (see utils/scanToken.ts). Off in development
 * with the rest of the metering, so testing on your own computer is not held up.
 *
 * A refusal is an ordinary 200 with an { error, message }, the same shape the other lookups use, so the app shows
 * the message in words.
 */
const MESSAGES: Record<string, string> = {
  missing: "Please scan the item again to get its prices.",
  invalid: "Please scan the item again to get its prices.",
  "wrong-phone": "Please scan the item again to get its prices.",
  expired: "That scan has run out. Scan the item again to get its prices.",
  "used-up": "You've checked this scan a lot of times. Scan the item again to check more prices.",
};

export function requireScanToken(req: Request, res: Response, next: NextFunction) {
  if (!freeScanCapEnabled()) return next();

  const header = req.headers["x-scan-token"];
  const token = req.body?.scanToken ?? (Array.isArray(header) ? header[0] : header);

  // Older app builds send no phone id with the price request; the signed token says which phone it was made for.
  const deviceId = callerDevice(req) ?? deviceOfScanToken(token);
  if (!deviceId) {
    res.status(400).json({
      error: "missing-device",
      message: "Something went wrong identifying your phone. Please update the app and try again.",
    });
    return;
  }

  const result = useScanToken(token, deviceId);
  if (result.ok) return next();

  res.json({ error: "scan-required", reason: result.reason, message: MESSAGES[result.reason] ?? MESSAGES.invalid });
}
