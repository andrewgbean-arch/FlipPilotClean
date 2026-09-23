import { Express, Request, Response } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";

import { loadListings, saveListings } from "./publishedListings";
import { rateLimit } from "../middleware/rateLimit";
import { callerDeviceId } from "./messages";
import { listingStatus } from "../utils/listingStatus";

/**
 * Seller reputation: when they joined, what they have sold, and what buyers
 * said afterwards.
 *
 * Every number here is counted from something that really happened. A seller
 * with no reviews has no rating — not a default four stars, which is what the
 * old seller card did and is worse than showing nothing, because it makes a
 * brand-new account look established.
 *
 * A seller is a device, because there are no accounts yet. The device id stays
 * on the server; buyers see a separate public id that cannot be used to
 * impersonate anyone.
 */

const SELLERS_PATH = path.join(__dirname, "../data/sellers.json");

export type Seller = {
  id: string;        // public
  deviceId: string;  // private, never sent to a client
  joinedAt: string;
  /**
   * What they want to be called. Chosen by them and not checked against
   * anything, so it is a name and nothing more — it carries no more weight
   * than the name on a market stall.
   */
  displayName?: string | null;
  /**
   * Sales from listings the clean-up has since deleted. Keeps "items sold"
   * honest without keeping the old listings themselves.
   */
  soldArchived?: number;
};

export type Review = {
  id: string;
  sellerId: string;
  byDeviceId: string;  // private
  listingId: string;
  stars: number;
  comment: string;
  createdAt: string;
};

export type SellerStore = { sellers: Seller[]; reviews: Review[] };

export function loadSellerStore(): SellerStore {
  if (!fs.existsSync(SELLERS_PATH)) return { sellers: [], reviews: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(SELLERS_PATH, "utf8"));
    return {
      sellers: Array.isArray(parsed?.sellers) ? parsed.sellers : [],
      reviews: Array.isArray(parsed?.reviews) ? parsed.reviews : [],
    };
  } catch {
    // A corrupt file must not wipe itself by being saved over with {}.
    throw new Error("Seller store could not be read");
  }
}

export function saveSellerStore(store: SellerStore) {
  fs.writeFileSync(SELLERS_PATH, JSON.stringify(store, null, 2));
}

/** A display name worth storing, or nothing. */
function cleanDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // One line, no runs of whitespace, short enough to fit on a card.
  const name = raw.replace(/\s+/g, " ").trim().slice(0, 40);
  return name === "" ? null : name;
}

/**
 * The seller for this device, created on their first listing. Joined date is
 * that first listing, because that is the first thing we actually know.
 *
 * A name given later replaces the one on record, so changing it in Settings
 * takes effect — but it never wipes an existing name just because a listing
 * arrived without one.
 */
export function ensureSeller(
  deviceId: string | null | undefined,
  displayName?: unknown
): Seller | null {
  if (typeof deviceId !== "string" || !deviceId.trim()) return null;

  const store = loadSellerStore();
  const name = cleanDisplayName(displayName);
  const existing = store.sellers.find((s) => s.deviceId === deviceId);

  if (existing) {
    if (name && name !== existing.displayName) {
      existing.displayName = name;
      saveSellerStore(store);
    }
    return existing;
  }

  const seller: Seller = {
    id: crypto.randomUUID(),
    deviceId,
    joinedAt: new Date().toISOString(),
    displayName: name,
  };

  store.sellers.push(seller);
  saveSellerStore(store);
  return seller;
}

function averageStars(reviews: Review[]): number | null {
  if (reviews.length === 0) return null;
  const total = reviews.reduce((sum, r) => sum + r.stars, 0);
  return Math.round((total / reviews.length) * 10) / 10;
}

export default function registerSellersRoute(app: Express) {
  /* -------------------------------------------------------
     A SELLER, AS A BUYER SEES THEM
  ------------------------------------------------------- */
  app.get("/sellers/:sellerId", (req: Request, res: Response) => {
    const store = loadSellerStore();
    const seller = store.sellers.find((s) => s.id === req.params.sellerId);
    if (!seller) return res.status(404).json({ ok: false, error: "Seller not found" });

    const theirListings = loadListings().filter((l: any) => l.sellerId === seller.id);
    const reviews = store.reviews
      .filter((r) => r.sellerId === seller.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    res.json({
      ok: true,
      seller: {
        id: seller.id,
        displayName: seller.displayName ?? null,
        joinedAt: seller.joinedAt,
        // Counted from the listings themselves, so there is no tally to drift.
        itemsSold: theirListings.filter((l: any) => l.soldAt).length + (seller.soldArchived ?? 0),
        itemsForSale: theirListings.filter((l: any) => !l.soldAt).length,
        stars: averageStars(reviews),
        reviewCount: reviews.length,
        reviews: reviews.slice(0, 20).map((r) => ({
          id: r.id,
          stars: r.stars,
          comment: r.comment,
          createdAt: r.createdAt,
        })),
      },
    });
  });

  /* -------------------------------------------------------
     LEAVE A REVIEW
     Only for a listing you actually talked to them about, only once,
     and never for yourself.
  ------------------------------------------------------- */
  app.post("/sellers/:sellerId/reviews", rateLimit(6), (req: Request, res: Response) => {
    const { deviceId, listingId, stars, comment } = req.body ?? {};

    if (typeof deviceId !== "string" || !deviceId.trim()) {
      return res.status(400).json({ ok: false, error: "Missing deviceId" });
    }

    const starCount = Number(stars);
    if (!Number.isInteger(starCount) || starCount < 1 || starCount > 5) {
      return res.status(400).json({ ok: false, error: "Stars must be 1 to 5" });
    }

    const store = loadSellerStore();
    const seller = store.sellers.find((s) => s.id === req.params.sellerId);
    if (!seller) return res.status(404).json({ ok: false, error: "Seller not found" });

    if (seller.deviceId === deviceId) {
      return res.status(403).json({
        ok: false,
        error: "own-listing",
        message: "You can't review yourself.",
      });
    }

    const listing = loadListings().find((l: any) => String(l.id) === String(listingId));
    if (!listing || listing.sellerId !== seller.id) {
      return res.status(400).json({ ok: false, error: "That isn't one of their listings" });
    }

    // The gate: you have to have messaged them about it. Otherwise anybody
    // could rate anybody, and a rating nobody earned is worth nothing.
    const talked = (listing.messages ?? []).some((m: any) => m.deviceId === deviceId);
    if (!talked) {
      return res.status(403).json({
        ok: false,
        error: "no-contact",
        message: "You can review a seller once you've messaged them about the item.",
      });
    }

    const already = store.reviews.some(
      (r) => r.byDeviceId === deviceId && String(r.listingId) === String(listingId)
    );
    if (already) {
      return res.status(409).json({
        ok: false,
        error: "already-reviewed",
        message: "You've already reviewed this one.",
      });
    }

    const review: Review = {
      id: crypto.randomUUID(),
      sellerId: seller.id,
      byDeviceId: deviceId,
      listingId: String(listingId),
      stars: starCount,
      comment: typeof comment === "string" ? comment.trim().slice(0, 500) : "",
      createdAt: new Date().toISOString(),
    };

    store.reviews.push(review);
    saveSellerStore(store);

    res.json({
      ok: true,
      review: { id: review.id, stars: review.stars, comment: review.comment, createdAt: review.createdAt },
    });
  });

  /* -------------------------------------------------------
     MARK ONE OF YOUR OWN LISTINGS SOLD
     This is the only thing "items sold" counts, so the number means
     what it says.
  ------------------------------------------------------- */
  app.post("/listings/:id/sold", rateLimit(20), (req: Request, res: Response) => {
    const { deviceId } = req.body ?? {};
    if (typeof deviceId !== "string" || !deviceId.trim()) {
      return res.status(400).json({ ok: false, error: "Missing deviceId" });
    }

    const listings = loadListings();
    const listing = listings.find((l: any) => String(l.id) === req.params.id);
    if (!listing) return res.status(404).json({ ok: false, error: "Listing not found" });

    if (listing.deviceId !== deviceId) {
      return res.status(403).json({ ok: false, error: "Not your listing" });
    }

    listing.soldAt = listing.soldAt ?? new Date().toISOString();
    // Sold ends any reservation: the outcome is known.
    listing.reservedAt = null;
    saveListings(listings);

    res.json({ ok: true, soldAt: listing.soldAt, status: "sold" });
  });

  /* -------------------------------------------------------
     RESERVE ONE OF YOUR OWN LISTINGS, OR PUT IT BACK ON SALE
     "Reserved, awaiting outcome" tells buyers somebody has said they will
     take it. It lapses by itself after RETENTION.reservationDays if it is
     never followed up (see utils/listingStatus.ts), and a sold listing
     cannot be reserved.
  ------------------------------------------------------- */
  for (const action of ["reserve", "unreserve"] as const) {
    app.post(`/listings/:id/${action}`, rateLimit(20), (req: Request, res: Response) => {
      const caller = callerDeviceId(req);
      if (!caller) return res.status(401).json({ ok: false, error: "Missing device id" });

      const listings = loadListings();
      const listing = listings.find((l: any) => String(l.id) === req.params.id);
      if (!listing) return res.status(404).json({ ok: false, error: "Listing not found" });
      if (listing.deviceId !== caller) {
        return res.status(403).json({ ok: false, error: "Not your listing" });
      }
      if (listing.soldAt) {
        return res.status(409).json({ ok: false, error: "This one is already sold." });
      }

      listing.reservedAt = action === "reserve" ? new Date().toISOString() : null;
      saveListings(listings);

      res.json({ ok: true, status: listingStatus(listing), reservedAt: listing.reservedAt });
    });
  }
}
