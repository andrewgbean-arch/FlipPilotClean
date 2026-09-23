import { Express, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import { callerDeviceId, threadIdFor } from "./messages";
import { listingStatus } from "../utils/listingStatus";
import { mediaForListing } from "../utils/media";
import { loadListings, saveListings } from "./publishedListings";
import { loadFairs, saveFairs } from "./fairs";
import { deleteUploads } from "../utils/uploadStore";
import { deleteUserData, exportUserData } from "../utils/userData";
import { runRetention } from "../utils/retentionJob";

/**
 * "My data": export it, delete it, and delete one listing or fair of your own.
 * Plus the marketplace operator's takedown tools, behind ADMIN_TOKEN.
 * The device id is the only identity there is, so it is what proves it is yours.
 */

function photosOf(item: any): string[] {
  const out: string[] = [];
  for (const p of Array.isArray(item?.photos) ? item.photos : []) if (typeof p === "string") out.push(p);
  for (const p of Array.isArray(item?.images) ? item.images : []) if (typeof p === "string") out.push(p);
  if (typeof item?.bestThumbnail === "string") out.push(item.bestThumbnail);
  return out;
}

function adminOk(req: Request, res: Response): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    res.status(404).json({ ok: false, error: "Not enabled" });
    return false;
  }
  if (req.headers["x-admin-token"] !== expected) {
    res.status(401).json({ ok: false, error: "Unauthorised" });
    return false;
  }
  return true;
}

export default function registerMeRoute(app: Express) {
  /* -------------------------------------------------------
     MY MESSAGES: every conversation across every listing, newest first.
     Ones where you are the buyer (one per listing you wrote to) and ones where
     you are the seller (one per person who wrote to you, per listing).
  ------------------------------------------------------- */
  app.get("/me/conversations", rateLimit(60), (req: Request, res: Response) => {
    const caller = callerDeviceId(req);
    if (!caller) return res.status(401).json({ ok: false, error: "Missing device id" });

    type Entry = {
      listingId: number | string;
      title: string;
      thumbnail: string | null;
      status: string;
      role: "buyer" | "seller";
      threadId: string | null;
      lastMessage: string;
      lastFrom: "me" | "them";
      lastAt: string;
      count: number;
    };
    const out: Entry[] = [];

    for (const l of loadListings()) {
      const messages: any[] = (Array.isArray(l.messages) ? l.messages : []).filter(
        (m: any) => typeof m?.threadId === "string" && m.threadId
      );
      if (messages.length === 0) continue;

      const asSeller = l.deviceId === caller;
      const threads = new Map<string, any[]>();
      for (const m of messages) {
        if (!asSeller && m.threadId !== threadIdFor(l.id, caller)) continue;
        (threads.get(m.threadId) ?? threads.set(m.threadId, []).get(m.threadId)!).push(m);
      }

      const thumb = mediaForListing({ photos: l.photos, bestThumbnail: null }, req).photos?.[0] ?? null;

      for (const [threadId, msgs] of threads) {
        const last = msgs[msgs.length - 1];
        // "me" is whoever is asking: the buyer's own words if a buyer, the seller's if a seller.
        const mine = asSeller ? last.author === "seller" : last.author === "buyer";
        out.push({
          listingId: l.id,
          title: typeof l.title === "string" ? l.title : "Listing",
          thumbnail: typeof thumb === "string" ? thumb : null,
          status: listingStatus(l),
          role: asSeller ? "seller" : "buyer",
          threadId: asSeller ? threadId : null,
          lastMessage: String(last.message ?? "").slice(0, 120),
          // FlipPilot's own note is the seller's action to the seller and news to the buyer.
          lastFrom: last.author === "system" ? (asSeller ? "me" : "them") : mine ? "me" : "them",
          lastAt: String(last.timestamp ?? ""),
          count: msgs.length,
        });
      }
    }

    out.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    res.json({ ok: true, conversations: out });
  });

  app.get("/me/export", rateLimit(10), (req: Request, res: Response) => {
    const deviceId = callerDeviceId(req);
    if (!deviceId) return res.status(401).json({ ok: false, error: "Missing device id" });
    res.json({ ok: true, data: exportUserData(deviceId) });
  });

  // Needs an explicit confirm so a stray request cannot wipe someone.
  app.delete("/me/data", rateLimit(5), (req: Request, res: Response) => {
    const deviceId = callerDeviceId(req);
    if (!deviceId) return res.status(401).json({ ok: false, error: "Missing device id" });
    if (req.body?.confirm !== "DELETE") {
      return res.status(400).json({ ok: false, error: 'Send { "confirm": "DELETE" } to confirm' });
    }
    res.json({ ok: true, removed: deleteUserData(deviceId) });
  });

  app.delete("/listings/:id", rateLimit(20), (req: Request, res: Response) => {
    const deviceId = callerDeviceId(req);
    if (!deviceId) return res.status(401).json({ ok: false, error: "Missing device id" });

    const listings = loadListings();
    const listing = listings.find((l: any) => String(l.id) === req.params.id);
    if (!listing) return res.status(404).json({ ok: false, error: "Listing not found" });
    if (listing.deviceId !== deviceId) {
      return res.status(403).json({ ok: false, error: "Not your listing" });
    }

    saveListings(listings.filter((l: any) => l !== listing));
    deleteUploads(photosOf(listing));
    res.json({ ok: true });
  });

  app.delete("/fairs/:id", rateLimit(20), (req: Request, res: Response) => {
    const deviceId = callerDeviceId(req);
    if (!deviceId) return res.status(401).json({ ok: false, error: "Missing device id" });

    const fairs = loadFairs();
    const fair = fairs.find((f) => f.id === req.params.id);
    if (!fair) return res.status(404).json({ ok: false, error: "Boot fair not found" });
    if (fair.ownerDeviceId !== deviceId) {
      return res.status(403).json({ ok: false, error: "You can only remove boot fairs you listed yourself." });
    }

    saveFairs(fairs.filter((f) => f !== fair));
    deleteUploads(photosOf(fair));
    res.json({ ok: true });
  });

  /* ---- for whoever runs the marketplace ---- */

  app.post("/admin/remove-listing", (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    const listings = loadListings();
    const listing = listings.find((l: any) => String(l.id) === String(req.body?.id));
    if (!listing) return res.status(404).json({ ok: false, error: "Listing not found" });
    saveListings(listings.filter((l: any) => l !== listing));
    deleteUploads(photosOf(listing));
    res.json({ ok: true });
  });

  app.post("/admin/remove-fair", (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    const fairs = loadFairs();
    const fair = fairs.find((f) => f.id === String(req.body?.id));
    if (!fair) return res.status(404).json({ ok: false, error: "Boot fair not found" });
    saveFairs(fairs.filter((f) => f !== fair));
    deleteUploads(photosOf(fair));
    res.json({ ok: true });
  });

  /** Runs the retention clean-up now instead of waiting for the schedule. */
  app.post("/admin/run-retention", (req: Request, res: Response) => {
    if (!adminOk(req, res)) return;
    res.json({ ok: true, removed: runRetention() });
  });
}
