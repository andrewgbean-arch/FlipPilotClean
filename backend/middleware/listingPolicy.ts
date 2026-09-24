import type { NextFunction, Request, Response } from "express";

import { POLICY, promoActive } from "../config/marketplacePolicy";
import { loadListings } from "../routes/publishedListings";
import { listingStatus } from "../utils/listingStatus";
import { allowedDeviceIds } from "./sellingGate";

/**
 * Decides whether a device may post (or relist) another listing. Replaces the
 * old Pro-only selling lock: during the launch offer anyone may sell.
 *
 *  - always: one live car per seller, and a flood guard on new listings;
 *  - after the offer: a car needs credits and items past the free allowance
 *    need credits (credits are not built yet, so those are refused for now).
 *
 * "Live" means neither sold nor run out (30 days). The device id is the only
 * identity there is, so these limits are only as strong as that (accounts will
 * tighten them).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type PolicyRefusal = { status: number; body: { ok: false; error: string; message: string } };

/**
 * `excludeId` is the listing being relisted, so it does not count against
 * itself. Returns null when the listing is allowed.
 */
export function evaluatePolicy(
  deviceId: string,
  isCar: boolean,
  excludeId?: string | number
): PolicyRefusal | null {
  // The phones the app is built and demonstrated on skip the limits, one by one.
  if (allowedDeviceIds().includes(deviceId)) {
    console.log(`listingPolicy: skipping limits for a device named in SELLING_ALLOWED_DEVICE_IDS (${deviceId.slice(0, 8)}…)`);
    return null;
  }

  const mine = loadListings().filter(
    (l: any) => l.deviceId === deviceId && String(l.id) !== String(excludeId ?? "")
  );

  const postedToday = mine.filter((l: any) => Date.parse(l.createdAt) > Date.now() - DAY_MS).length;
  if (postedToday >= POLICY.maxNewListingsPerDay) {
    return {
      status: 429,
      body: {
        ok: false,
        error: "daily-limit",
        message: "You've posted a lot of listings today. Please try again tomorrow.",
      },
    };
  }

  const live = mine.filter((l: any) => {
    const s = listingStatus(l);
    return s === "available" || s === "reserved";
  });
  const liveCars = live.filter((l: any) => String(l.category ?? "").toLowerCase() === POLICY.carCategory || l.type === "flip");

  if (isCar && liveCars.length >= POLICY.maxActiveCarsPerSeller) {
    return {
      status: 409,
      body: {
        ok: false,
        error: "car-limit",
        message: "You already have a car for sale. Mark it as sold or delete it before listing another.",
      },
    };
  }

  if (!promoActive()) {
    if (isCar) {
      return {
        status: 402,
        body: {
          ok: false,
          error: "credits-required",
          message: `Listing a car costs ${POLICY.carCreditCost} credits. Credits are coming soon.`,
        },
      };
    }
    const liveItems = live.length - liveCars.length;
    if (liveItems >= POLICY.freeActiveItemsAfterPromo) {
      return {
        status: 402,
        body: {
          ok: false,
          error: "credits-required",
          message: `You have ${POLICY.freeActiveItemsAfterPromo} items for sale. More listings need credits, which are coming soon. Mark one as sold or delete one to add another.`,
        },
      };
    }
  }

  return null;
}

export function listingPolicy(req: Request, res: Response, next: NextFunction) {
  const deviceId = typeof req.body?.deviceId === "string" ? req.body.deviceId.trim() : "";
  if (!deviceId) {
    return res.status(400).json({
      ok: false,
      error: "missing-device",
      message: "Something went wrong identifying your phone. Please update the app and try again.",
    });
  }

  // Cars: the vehicle category, and the older "publish a flip" route which was for vehicles.
  const category = typeof req.body?.category === "string" ? req.body.category.trim().toLowerCase() : "";
  // Express matches routes ignoring case and a trailing slash, so this must too.
  const isCar = category === POLICY.carCategory || /^\/publish-flip\/?$/i.test(req.path);

  // Handlers store the id they read from the body: hand them the trimmed one, so
  // "abc " and "abc" can't be two sellers with two sets of limits.
  req.body.deviceId = deviceId;

  const refusal = evaluatePolicy(deviceId, isCar);
  if (refusal) return res.status(refusal.status).json(refusal.body);

  next();
}
