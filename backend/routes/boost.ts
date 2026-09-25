import { Express, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import { requireAccount } from "../middleware/accountGuard";
import { POLICY } from "../config/marketplacePolicy";
import { callerDeviceId } from "./messages";
import { loadListings, saveListings } from "./publishedListings";
import { listingStatus } from "../utils/listingStatus";
import { refund, spend } from "../utils/creditStore";
import { boostedUntilMs, isBoosted } from "../utils/boost";

/**
 * Boost: pay credits to put one of your own listings at the top of the feed for a week.
 *
 *   POST /listings/:id/boost
 *
 * A boosted listing is labelled "Promoted" wherever it is shown, so nobody mistakes a paid position for
 * a recommendation. A boost is only for a listing that is live now, only one at a time, and only by its
 * owner. The credits are taken in one step just before the boost is saved, and given back if the save
 * fails, so a boost that didn't happen never costs anything.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export default function registerBoostRoute(app: Express) {
  app.post("/listings/:id/boost", rateLimit(20), requireAccount, (req: Request, res: Response) => {
    const caller = callerDeviceId(req);
    if (!caller) return res.status(401).json({ ok: false, error: "Missing device id" });

    const account = req.account;
    if (!account) {
      return res.status(401).json({ ok: false, error: "sign-in-required", message: "Please sign in with your email to boost a listing." });
    }
    // Only the account that owns the listing's phone id can spend its credits on it.
    if (account.canonicalDeviceId !== caller) {
      return res.status(403).json({ ok: false, error: "identity-mismatch", message: "This phone needs to sign in again." });
    }

    const listings = loadListings();
    const listing = listings.find((l: any) => String(l.id) === req.params.id);
    if (!listing) return res.status(404).json({ ok: false, error: "Listing not found" });
    if (listing.deviceId !== caller) return res.status(403).json({ ok: false, error: "Not your listing" });

    const status = listingStatus(listing);
    if (status !== "available" && status !== "reserved") {
      return res.status(409).json({
        ok: false,
        error: "not-live",
        message: status === "sold" ? "That one is already sold." : "That listing has run out. Relist it first, then boost it.",
      });
    }

    if (isBoosted(listing)) {
      return res.status(409).json({
        ok: false,
        error: "already-boosted",
        message: "This listing is already boosted.",
        boostedUntil: new Date(boostedUntilMs(listing)).toISOString(),
      });
    }

    const cost = POLICY.boostCreditCost;
    const paid = spend(account.id, cost, "boost");
    if (!paid.ok) {
      return res.status(402).json({
        ok: false,
        error: "credits-required",
        message: `A boost costs ${cost} credits and you have ${paid.balance}.`,
        credits: paid.balance,
        needed: cost,
      });
    }

    try {
      const now = Date.now();
      listing.boostedAt = new Date(now).toISOString();
      listing.boostedUntil = new Date(now + POLICY.boostDays * DAY_MS).toISOString();
      saveListings(listings);
    } catch (err: any) {
      refund(account.id, cost, "refund");
      console.error("boost could not be saved:", err?.message);
      return res.status(500).json({ ok: false, error: "server", message: "Something went wrong. You haven't been charged. Please try again." });
    }

    res.json({ ok: true, boostedUntil: listing.boostedUntil, credits: paid.balance, charged: cost });
  });
}
