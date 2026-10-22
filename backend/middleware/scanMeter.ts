import type { NextFunction, Request, Response } from "express";
import { planStatus } from "../subscriptions/revenueCat";
import { PRO_DAILY_SCANS, returnProScan, takeProScan, utcDay } from "../utils/proAllowance";
import {
  MONTHLY_FREE_LIMIT,
  anonymousScansAllowed,
  freeScanCapEnabled,
  freeScanStatus,
  freeScanSubject,
  resetDateInWords,
  returnAddressScan,
  returnFreeScan,
  takeAddressScan,
  takeFreeScan,
} from "./freeScanLimit";
import { getBalance, refund, spend } from "../utils/creditStore";
import { allowedDeviceIds } from "./sellingGate";
import { networkOf } from "../utils/clientAddress";

/**
 * What a lookup (barcode, photo or search) costs the person. FlipPilot is free to use: you sign up (an email address
 * and a one-time code) and get MONTHLY_FREE_LIMIT (100) free scans a month; the Pro plan (4.99 pounds a month) is
 * unlimited, with a fair-use ceiling a day. In this order:
 *
 *   0. not signed in: refused with "sign in", unless ANONYMOUS_SCANS=on (a testing lever, see freeScanLimit.ts);
 *   1. one of their free scans this month, counted per ACCOUNT whatever phone id the request names (or, with
 *      anonymous scans on, a few per phone and a weekly cap per network address);
 *   2. otherwise, on the Pro plan, one of PRO_DAILY_SCANS scans today;
 *   3. otherwise one scan credit from their account (credits are no longer on sale, but anyone holding some keeps them);
 *   4. otherwise the lookup is refused, and the reply says which of "sign in", "go Pro" or "that's today's limit" fits.
 *
 * The scan is paid for when it starts and PAID BACK if it then fails, so a lookup that returns no
 * result never costs anyone anything. A person who cancels on their own phone before the answer
 * arrives is not refunded: the lookup ran and cost us the same.
 *
 * Off in development (see freeScanCapEnabled) so testing on your own machine never runs out.
 *
 * On a live server, a device named in SELLING_ALLOWED_DEVICE_IDS (see sellingGate.ts — the
 * same list already used for the selling/Pro gate, for the same reason: phones the app is
 * being built and demonstrated on) skips this meter entirely, so testing on a real phone
 * against production never runs out of free scans either.
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
    if (!(failed || res.statusCode >= 400)) return;
    // This runs in an event handler, where nothing catches an error: one thrown by a full disk or a
    // locked counter file would have been an uncaught exception, which takes the whole server down.
    // Worst case now is that one failed scan is not given back, and it is logged.
    try {
      undo();
    } catch (err: any) {
      console.log("SCAN METER: could not pay a failed scan back:", err?.message || err);
    }
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

  if (allowedDeviceIds().includes(deviceId)) {
    console.log(`scanMeter: allowing a device named in SELLING_ALLOWED_DEVICE_IDS (${deviceId.slice(0, 8)}…)`);
    return next();
  }

  // Everything below reads/writes the credits, free-scan and Pro-allowance JSON files, which
  // deliberately THROW rather than silently reset to {} on a corrupted file (see creditStore.ts) —
  // on purpose, so a damaged file is never mistaken for an empty one. But Express 4 does not catch a
  // throw from inside async middleware like this one: with nothing here to catch it, that throw was
  // an unhandled rejection, and Node's default policy for those is to crash the whole process — one
  // damaged file taking down scanning for every user, not just whoever's file it was. A clean 503
  // keeps the deliberate "never guess" behaviour of the stores while stopping it from being able to
  // take the server down.
  try {
    const account = req.account ?? null;

    // Signing up is how you scan (see freeScanLimit.ts). The error code is the one the app already turns into a
    // "Sign in" prompt, so an older build of the app still does the right thing.
    if (!account && !anonymousScansAllowed()) {
      res.json({
        error: "free-scan-limit",
        message: `Sign in to start scanning. It's free: we email you a six-digit code (no password), and you get ${MONTHLY_FREE_LIMIT} free scans a month.`,
        signedIn: false,
        signInRequired: true,
        credits: 0,
      });
      return;
    }

    // Whose free scans these are: the signed-in account's, otherwise the phone's own.
    const freeFor = freeScanSubject(deviceId, account);
    // Not signed in: the scan must also fit under the allowance for the whole network address, the one
    // limit a script cannot dodge by sending a made-up device id each time (see freeScanLimit.ts).
    const address = account ? null : networkOf(req.ip);
    const addressOk = account ? true : takeAddressScan(address);
    let tookFree = false;
    try {
      tookFree = addressOk && takeFreeScan(freeFor.key, freeFor.limit);
    } catch (err) {
      // The counter file could not be written, so no scan happened: the address's scan is not spent either.
      if (addressOk) returnAddressScan(address);
      throw err;
    }
    if (tookFree) {
      payBackOnFailure(res, () => {
        returnFreeScan(freeFor.key);
        returnAddressScan(address);
      });
      return next();
    }
    // The person had none left, so the address's scan taken above was not used after all.
    if (addressOk) returnAddressScan(address);

    // Only worth the extra round trip once the free scans are gone.
    const plan = await planStatus(deviceId);
    let proLimitHit = false;
    if (plan.active) {
      const day = utcDay();
      if (takeProScan(deviceId, day)) {
        payBackOnFailure(res, () => returnProScan(deviceId, day));
        return next();
      }
      proLimitHit = true;
    }

    const free = freeScanStatus(freeFor.key, freeFor.limit);
    const fairUse = `You've reached today's fair-use limit of ${PRO_DAILY_SCANS} scans on Pro. It starts again tomorrow.`;

    if (account) {
      if (spend(account.id, 1, "scan").ok) {
        payBackOnFailure(res, () => {
          refund(account.id, 1, "scan-refund");
        });
        return next();
      }
      res.json(
        proLimitHit
          ? { error: "pro-daily-limit", message: fairUse, signedIn: true, credits: getBalance(account.id) }
          : {
              error: "out-of-scans",
              message: `You've used your ${free.limit} free scans this month. Go Pro for unlimited scans, or they come back on ${resetDateInWords(free.resetsOn)}.`,
              resetsOn: free.resetsOn,
              signedIn: true,
              credits: getBalance(account.id),
            }
      );
      return;
    }

    // Only reachable with anonymous scans switched on.
    res.json(
      proLimitHit
        ? { error: "pro-daily-limit", message: fairUse, signedIn: false, credits: 0 }
        : {
            error: "free-scan-limit",
            message: addressOk
              ? `You've used your ${free.limit} free scans without an account. Sign in (it's free) to get ${MONTHLY_FREE_LIMIT} free scans a month, or they come back on ${resetDateInWords(free.resetsOn)}.`
              : `A lot of free scans have been used on this network this week. Sign in (it's free) to keep scanning: you get ${MONTHLY_FREE_LIMIT} free scans a month of your own.`,
            resetsOn: free.resetsOn,
            signedIn: false,
            credits: 0,
          }
    );
  } catch (err: any) {
    console.log("SCAN METER ERROR:", err?.message || err);
    res.status(503).json({
      error: "busy",
      message: "FlipPilot is having trouble right now. Please try again in a moment.",
    });
  }
}
