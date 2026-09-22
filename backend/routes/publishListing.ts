import { Express, Request, Response } from "express";
import { loadListings, saveListings } from "./publishedListings";
import { rateLimit } from "../middleware/rateLimit";
import { sellingGate } from "../middleware/sellingGate";

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
      createdAt: new Date().toISOString(),
      messages: []
    };

    listings.push(listing);
    saveListings(listings);

    res.json({ ok: true, listing });
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
      deviceId
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
      createdAt: new Date().toISOString(),
      messages: []
    };

    listings.push(listing);
    saveListings(listings);

    res.json({ ok: true, listing });
  });

  /* -------------------------------------------------------
     MY LISTINGS
     Filtered to the caller's own deviceId when sent. An older client
     that doesn't send one still gets everything, rather than nothing.
  ------------------------------------------------------- */
  app.get("/my-listings", (req: Request, res: Response) => {
    const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId : null;
    const listings = loadListings();
    res.json(deviceId ? listings.filter((l: any) => l.deviceId === deviceId) : listings);
  });
}
