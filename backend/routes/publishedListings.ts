import { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { toPublicListing } from "../utils/sellerOrigin";
import { blockedBy } from "../utils/safetyStore";

const LISTINGS_PATH = path.join(__dirname, "../data/published-listings.json");

export function loadListings(): any[] {
  if (!fs.existsSync(LISTINGS_PATH)) return [];
  return JSON.parse(fs.readFileSync(LISTINGS_PATH, "utf8"));
}

export function saveListings(listings: any[]) {
  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(listings, null, 2));
}

export default function registerPublishedListingsRoute(app: Express) {
  app.get("/published-listings", (req: Request, res: Response) => {
    // Someone you have blocked stops appearing in what you browse.
    const header = req.headers["x-device-id"];
    const caller = (Array.isArray(header) ? header[0] : header)?.trim();
    const hidden = caller ? blockedBy(caller) : [];

    res.json(
      loadListings()
        .filter((l: any) => !(typeof l.deviceId === "string" && hidden.includes(l.deviceId)))
        .map(toPublicListing)
    );
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
