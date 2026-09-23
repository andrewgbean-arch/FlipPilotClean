import { Express, Request, Response } from "express";
import { loadListings, saveListings } from "./publishedListings";
import { rateLimit } from "../middleware/rateLimit";
import { sellingGate } from "../middleware/sellingGate";
import { readSellerOrigin, toPublicListing } from "../utils/sellerOrigin";
import { ensureSeller } from "./sellers";

/**
 * The per-category answers, kept as a flat map of short strings.
 * Anything else a client sends — nested objects, huge blobs, hundreds of keys —
 * is dropped rather than stored.
 */
function cleanDetails(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= 24) break;
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(key)) continue;
    if (typeof value !== "string" && typeof value !== "number") continue;

    const text = String(value).trim();
    if (text) out[key] = text.slice(0, 300);
  }
  return out;
}

export default function registerPublishListingRoute(app: Express) {
  /* -------------------------------------------------------
     PUBLISH A FLIP (from marketplace/PublishFlip.tsx)
  ------------------------------------------------------- */
  app.post("/publish-flip", rateLimit(10), sellingGate, (req: Request, res: Response) => {
    const { title, price, mileage, description, location, deviceId } = req.body;

    if (!title || !price || !description || !location) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const listings = loadListings();

    const listing = {
      id: Date.now(),
      type: "flip",
      title,
      price: Number(price),
      mileage: mileage != null ? Number(mileage) : null,
      description,
      location,
      deviceId: typeof deviceId === "string" ? deviceId : null,
      sellerId: ensureSeller(deviceId)?.id ?? null,
      soldAt: null,
      sellerOrigin: readSellerOrigin(req),
      createdAt: new Date().toISOString(),
      messages: []
    };

    listings.push(listing);
    saveListings(listings);

    res.json({ ok: true, listing: toPublicListing(listing) });
  });

  /* -------------------------------------------------------
     CREATE A GENERAL LISTING (from marketplace/create/new.tsx)
  ------------------------------------------------------- */
  app.post("/create-listing", rateLimit(10), sellingGate, (req: Request, res: Response) => {
    const {
      title,
      price,
      description,
      category,
      location,
      condition,
      details,
      photos,
      bestThumbnail,
      flipScore,
      deviceId,
      sellerName
    } = req.body;

    if (!title || !price) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    // A listing with no category is a listing nobody finds, so it is not optional.
    // Which categories exist is the app's business; the server only insists there is one.
    if (typeof category !== "string" || !category.trim()) {
      return res.status(400).json({ ok: false, error: "Missing category" });
    }

    const listings = loadListings();

    const listing = {
      id: Date.now(),
      type: "item",
      title,
      price: Number(price),
      description: description ?? "",
      category: category.trim(),
      location: typeof location === "string" && location.trim() ? location.trim() : null,
      condition: typeof condition === "string" && condition.trim() ? condition.trim() : null,
      // The category's own questions — size, dimensions, network lock and so on.
      details: cleanDetails(details),
      photos: photos ?? [],
      bestThumbnail: bestThumbnail ?? photos?.[0] ?? null,
      flipScore: flipScore ?? null,
      deviceId: typeof deviceId === "string" ? deviceId : null,
      // The public side of who is selling it, so a buyer can see their history.
      sellerId: ensureSeller(deviceId, sellerName)?.id ?? null,
      soldAt: null,
      // A private review flag. Stripped from everything the public can read.
      sellerOrigin: readSellerOrigin(req),
      createdAt: new Date().toISOString(),
      messages: []
    };

    listings.push(listing);
    saveListings(listings);

    res.json({ ok: true, listing: toPublicListing(listing) });
  });

  /* -------------------------------------------------------
     MY LISTINGS
     Only ever the caller's own. With no device id there is no "own", so
     the answer is nothing rather than everybody's listings.
  ------------------------------------------------------- */
  app.get("/my-listings", (req: Request, res: Response) => {
    const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId.trim() : "";
    if (!deviceId) return res.json([]);
    const mine = loadListings().filter((l: any) => l.deviceId === deviceId);
    res.json(mine.map(toPublicListing));
  });

  /* -------------------------------------------------------
     FLAGGED LISTINGS — for whoever runs the marketplace, nobody else.
     Off unless ADMIN_TOKEN is set on the server, and then it needs that
     token in the x-admin-token header. Without this the origin flag would
     be data nobody can ever see.
  ------------------------------------------------------- */
  app.get("/admin/flagged-listings", (req: Request, res: Response) => {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected) return res.status(404).json({ ok: false, error: "Not enabled" });

    const given = req.headers["x-admin-token"];
    if (given !== expected) return res.status(401).json({ ok: false, error: "Unauthorised" });

    const flagged = loadListings()
      .filter((l: any) => l.sellerOrigin?.flagged)
      .map((l: any) => ({
        id: l.id,
        title: l.title,
        price: l.price,
        category: l.category,
        location: l.location,
        createdAt: l.createdAt,
        sellerOrigin: l.sellerOrigin
      }));

    res.json({ ok: true, count: flagged.length, listings: flagged });
  });
}
