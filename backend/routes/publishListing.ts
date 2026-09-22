import { Express, Request, Response } from "express";
import { loadListings, saveListings } from "./publishedListings";
import { rateLimit } from "../middleware/rateLimit";
import { sellingGate } from "../middleware/sellingGate";

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
    const { title, price, description, category, photos, bestThumbnail, flipScore, deviceId } = req.body;

    if (!title || !price) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const listings = loadListings();

    const listing = {
      id: Date.now(),
      type: "item",
      title,
      price: Number(price),
      description: description ?? "",
      category: category ?? "General",
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
