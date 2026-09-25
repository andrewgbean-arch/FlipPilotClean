import { Express, Request, Response } from "express";
import { rateLimit } from "../middleware/rateLimit";
import { callerDeviceId } from "./messages";
import { buildConversations } from "../utils/conversations";
import { markInboxSeen } from "../utils/readState";
import { loadListings, saveListings } from "./publishedListings";
import { loadFairs, saveFairs } from "./fairs";
import { deleteUploads } from "../utils/uploadStore";
import { deleteUserData, exportUserData } from "../utils/userData";
import { adminOk } from "../utils/adminAuth";
import { runRetention } from "../utils/retentionJob";
import { creditsFor } from "../utils/creditStore";

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

export default function registerMeRoute(app: Express) {
  /* -------------------------------------------------------
     MY MESSAGES: every conversation across every listing, newest first.
     Opening the inbox counts as having seen what is new (see /me/unread).
  ------------------------------------------------------- */
  app.get("/me/conversations", rateLimit(60), (req: Request, res: Response) => {
    const caller = callerDeviceId(req);
    if (!caller) return res.status(401).json({ ok: false, error: "Missing device id" });

    const conversations = buildConversations(caller, req);
    markInboxSeen(caller);
    res.json({ ok: true, conversations });
  });

  /* -------------------------------------------------------
     ANYTHING NEW? What makes the Home tab flash: how many conversations have
     had a message from the other side since the inbox was last opened, and
     how many are unread in all. Does not mark anything as seen.
  ------------------------------------------------------- */
  app.get("/me/unread", rateLimit(120), (req: Request, res: Response) => {
    const caller = callerDeviceId(req);
    if (!caller) return res.status(401).json({ ok: false, error: "Missing device id" });

    const conversations = buildConversations(caller, req);
    res.json({
      ok: true,
      newCount: conversations.filter((c) => c.isNew).length,
      unreadCount: conversations.filter((c) => c.unread).length,
    });
  });

  app.get("/me/export", rateLimit(10), (req: Request, res: Response) => {
    const deviceId = callerDeviceId(req);
    if (!deviceId) return res.status(401).json({ ok: false, error: "Missing device id" });
    res.json({
      ok: true,
      data: { ...exportUserData(deviceId), ...(req.account ? { scanCredits: creditsFor(req.account.id) } : {}) },
    });
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
