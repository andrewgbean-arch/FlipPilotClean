import { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { toPublicListing } from "../utils/sellerOrigin";

const LISTINGS_PATH = path.join(__dirname, "../data/published-listings.json");

export function loadListings(): any[] {
  if (!fs.existsSync(LISTINGS_PATH)) return [];
  return JSON.parse(fs.readFileSync(LISTINGS_PATH, "utf8"));
}

export function saveListings(listings: any[]) {
  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(listings, null, 2));
}

export default function registerPublishedListingsRoute(app: Express) {
  app.get("/published-listings", (_req: Request, res: Response) => {
    res.json(loadListings().map(toPublicListing));
  });

  app.get("/published-listings/:id", (req: Request, res: Response) => {
    const listings = loadListings();
    const listing = listings.find((l: any) => String(l.id) === req.params.id);

    if (!listing) {
      return res.status(404).json({ ok: false, error: "Listing not found" });
    }

    res.json(toPublicListing(listing));
  });
}
