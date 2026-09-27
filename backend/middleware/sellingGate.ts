import type { NextFunction, Request, Response } from "express";
import { isProSubscriber } from "../subscriptions/revenueCat";

/* --------------------------------------------------
   Exporting a listing to eBay comes with the Trader plan (see app/upgrade.tsx).
   Listing on the FlipPilot Marketplace itself does not: that is decided by
   config/marketplacePolicy.ts (free during the launch offer, cars cost credits).
   Only a subscription RevenueCat itself confirms counts, never a flag from the phone.

   SELLING_ALLOWED_DEVICE_IDS lets named devices through — the phones the
   app is being built and demonstrated on, which have nothing to buy Pro
   with and would otherwise be unable to use half of what they are testing.
   It is a comma-separated list of device ids, set on the server, empty by
   default, and it names devices one at a time: it never widens the gate for
   anyone else. A device id is client-supplied, so this is a convenience for
   whoever runs the server and not a security boundary — which is fine for
   what it is, but it is why the list lives in the server's own environment
   and not in anything a client can reach.
-------------------------------------------------- */
export function allowedDeviceIds(): string[] {
  return (process.env.SELLING_ALLOWED_DEVICE_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function sellingGate(req: Request, res: Response, next: NextFunction) {
  const deviceId = typeof req.body?.deviceId === "string" ? req.body.deviceId : null;

  // No device id means we can't tell whose Pro status to check, so it can't be
  // let through: leaving the field out would otherwise skip the gate entirely.
  if (!deviceId) {
    return res.status(400).json({
      ok: false,
      error: "missing-device",
      message: "Something went wrong identifying your phone. Please update the app and try again.",
    });
  }

  if (allowedDeviceIds().includes(deviceId)) {
    // Said out loud, so a device left on the list by accident is visible in
    // the logs rather than quietly selling for free forever.
    console.log(`sellingGate: allowing a device named in SELLING_ALLOWED_DEVICE_IDS (${deviceId.slice(0, 8)}…)`);
    return next();
  }

  if (await isProSubscriber(deviceId)) return next();

  res.status(403).json({
    ok: false,
    error: "selling-locked",
    message: "Exporting listings to eBay comes with the Trader plan. Selling on the FlipPilot Marketplace itself doesn't need it.",
  });
}
