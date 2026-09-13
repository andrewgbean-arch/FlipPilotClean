import { Express, Request, Response } from "express";
import { loadListings, saveListings } from "./publishedListings";

export default function registerPublishListingRoute(app: Express) {
  /* -------------------------------------------------------
     PUBLISH A FLIP (from marketplace/PublishFlip.tsx)
  ------------------------------------------------------- */
  app.post("/publish-flip", (req: Request, res: Response) => {
    const { title, price, mileage, description, location } = req.body;

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
  app.post("/create-listing", (req: Request, res: Response) => {
    const { title, price, description, category, photos, bestThumbnail, flipScore } = req.body;

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
      createdAt: new Date().toISOString(),
      messages: []
    };

    listings.push(listing);
    saveListings(listings);

    res.json({ ok: true, listing });
  });

  /* -------------------------------------------------------
     MY LISTINGS
     No user auth exists in this app yet — this returns every
     published listing. Once accounts/device identity exist,
     filter by owner here.
  ------------------------------------------------------- */
  app.get("/my-listings", (_req: Request, res: Response) => {
    res.json(loadListings());
  });
}
