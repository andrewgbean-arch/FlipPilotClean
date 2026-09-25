import { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { toPublicListing } from "../utils/sellerOrigin";
import { blockedBy } from "../utils/safetyStore";
import { mediaForListing } from "../utils/media";
import { listingStatus } from "../utils/listingStatus";
import { boostedAtMs, isBoosted } from "../utils/boost";
import { dataPath } from "../config/dataDir";

const LISTINGS_PATH = dataPath("published-listings.json");

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
        // A listing that has run its 30 days is no longer for sale. Its owner still
        // sees it in "my listings" and can relist it.
        .filter((l: any) => listingStatus(l) !== "expired")
        // Newest first, except that a boosted listing (see routes/boost.ts) goes to the top for the week it paid
        // for, the most recent boost first. Nothing else is ever moved.
        .sort((a: any, b: any) => {
          const boostA = isBoosted(a);
          const boostB = isBoosted(b);
          if (boostA !== boostB) return boostA ? -1 : 1;
          if (boostA && boostB) return boostedAtMs(b) - boostedAtMs(a);
          return (Date.parse(b.listedAt ?? b.createdAt) || 0) - (Date.parse(a.listedAt ?? a.createdAt) || 0);
        })
        .map((l: any) => mediaForListing(toPublicListing(l), req))
    );
  });

  app.get("/published-listings/:id", (req: Request, res: Response) => {
    const listings = loadListings();
    const listing = listings.find((l: any) => String(l.id) === req.params.id);

    if (!listing) {
      return res.status(404).json({ ok: false, error: "Listing not found" });
    }

    res.json(mediaForListing(toPublicListing(listing), req));
  });
}
