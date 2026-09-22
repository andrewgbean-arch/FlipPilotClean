import type { NextFunction, Request, Response } from "express";
import { isProSubscriber } from "../subscriptions/revenueCat";

/* --------------------------------------------------
   Selling on the Marketplace is a paid feature (see app/upgrade.tsx):
   Free can browse but not sell, Bolt-on can sell up to 5 items, Pro
   sells unlimited. Bolt-on has no real RevenueCat product yet (see
   backend/subscriptions/revenueCat.ts) - there's no way today to tell
   a genuine Bolt-on subscriber apart from a Free one, only a verified
   Pro entitlement can be checked server-side. So until Bolt-on is a
   real purchasable product, selling is Pro-only here; add a listing
   count check for a real Bolt-on entitlement once that product exists,
   rather than a guessed cap for everyone that would undercut the whole
   point of gating selling behind payment.

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
function allowedDeviceIds(): string[] {
  return (process.env.SELLING_ALLOWED_DEVICE_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function sellingGate(req: Request, res: Response, next: NextFunction) {
  const deviceId = typeof req.body?.deviceId === "string" ? req.body.deviceId : null;

  // No device id sent (an older app build, or a direct API call) - let it
  // through rather than block a legitimate request over one missing field,
  // the same rule freeScanLimit uses.
  if (!deviceId) return next();

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
    message: "Selling on the Marketplace needs Bolt-on or Pro. Upgrade to start listing items.",
  });
}
