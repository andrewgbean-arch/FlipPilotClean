import { Express, Request, Response } from "express";
import { bridgeAuth } from "../middleware/bridgeAuth";
import { loadListings, saveListings } from "./publishedListings";
import { cleanDetails } from "./publishListing";
import { ensureTradeSeller } from "./sellers";
import { dealerOwnerId } from "../utils/dealerOwner";
import { deleteUploads, ownedUploads, saveUpload, sniffImage, uploadsBy } from "../utils/uploadStore";
import { isBlockedEitherWay } from "../utils/safetyStore";
import { mediaForListing } from "../utils/media";
import { toPublicListing } from "../utils/sellerOrigin";
import { threadIdFor } from "./messages";
import { verifyCar } from "../utils/carListing";
import { normaliseRegistration } from "../utils/dvla";

/**
 * How FlipPilot Dealer OS lists a dealership's cars here and answers the people
 * who write about them. Every route needs the bridge key (middleware/bridgeAuth.ts)
 * and only ever touches listings owned by the dealership named in the path.
 *
 * Nothing here can reach a buyer's identity: messages come out with an opaque
 * thread id and their text, never the buyer's device id.
 */

const MAX_PHOTOS_PER_DEALERSHIP = 400;
const MAX_PHOTOS_PER_CAR = 10;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_PER_PULL = 200;

type Status = "available" | "reserved" | "sold";
const STATUSES: Status[] = ["available", "reserved", "sold"];

const text = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

function idOk(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v);
}

function owned(ownerId: string, sourceId: string) {
  return (l: any) => l.deviceId === ownerId && l.sourceId === sourceId;
}

export default function registerBridgeRoutes(app: Express) {
  /* One photo at a time, as the phone app does. Owned by the dealership, used by its listings. */
  app.post("/bridge/dealers/:dealershipId/photos", bridgeAuth, (req: Request, res: Response) => {
    const { dealershipId } = req.params;
    if (!idOk(dealershipId)) return res.status(400).json({ ok: false, error: "Bad dealership id" });
    const ownerId = dealerOwnerId(dealershipId);

    const raw = typeof req.body?.imageBase64 === "string" ? req.body.imageBase64 : "";
    const encoded = raw.replace(/^data:image\/[a-z+]+;base64,/i, "");
    if (encoded.length < 100) return res.status(400).json({ ok: false, error: "No photo received" });
    const buffer = Buffer.from(encoded, "base64");
    if (buffer.length > MAX_BYTES) return res.status(413).json({ ok: false, error: "That photo is too large" });
    const type = sniffImage(buffer);
    if (!type) return res.status(400).json({ ok: false, error: "Only JPEG, PNG or WebP photos are allowed" });
    if (uploadsBy(ownerId).length >= MAX_PHOTOS_PER_DEALERSHIP) {
      return res.status(429).json({ ok: false, error: "Too many photos uploaded" });
    }
    res.json({ ok: true, path: saveUpload(ownerId, buffer, type) });
  });

  /* List a car, or bring its listing up to date. Safe to repeat: one listing per car.
     A dealership pays no credits. If it sends the car's registration the car gets the same DVLA check and
     MOT history as any other (the plate stays private); without one it is listed as before. */
  app.put("/bridge/dealers/:dealershipId/listings/:sourceId", bridgeAuth, async (req: Request, res: Response) => {
    const { dealershipId, sourceId } = req.params;
    if (!idOk(dealershipId) || !idOk(sourceId)) return res.status(400).json({ ok: false, error: "Bad id" });
    const ownerId = dealerOwnerId(dealershipId);

    const title = text(req.body?.title, 120);
    const price = Number(req.body?.price);
    if (!title) return res.status(400).json({ ok: false, error: "A title is needed" });
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ ok: false, error: "A price above zero is needed" });
    }
    const status: Status = STATUSES.includes(req.body?.status) ? req.body.status : "available";

    // The registration, if the dealership sent one: checked with the DVLA (and the MOT history fetched) BEFORE
    // anything is saved, so a car that fails is held back with the reason and nothing half-done is left.
    const details = cleanDetails(req.body?.details);
    let dvlaCheck: unknown = undefined;
    const sentReg = typeof req.body?.registration === "string" ? req.body.registration.trim() : "";
    // Never for a car being marked sold (an outage must not keep a sold car on sale). Not again for a car whose
    // plate and mileage are as already checked, so a price change does not go back to the DVLA.
    if (sentReg && status !== "sold") {
      const existing = loadListings().find(owned(ownerId, sourceId));
      const sameCar = !!existing?.dvlaCheck?.registration && existing.dvlaCheck.registration === normaliseRegistration(sentReg);
      const sameMiles = String(existing?.details?.mileage ?? "") === String(details.mileage ?? "");
      if (!(sameCar && sameMiles)) {
        let checked;
        try {
          checked = await verifyCar(
            { registration: sentReg, make: details.make, mileage: details.mileage ?? req.body?.mileage },
            existing?.id
          );
        } catch (err: any) {
          console.error("bridge car check failed:", err?.message);
          return res.status(500).json({ ok: false, error: "server", message: "The car could not be checked just now. Please try again." });
        }
        if (!checked.ok) return res.status(checked.status).json(checked.body);
        dvlaCheck = checked.vehicle ?? undefined;
      }
    }

    const seller = ensureTradeSeller(ownerId, req.body?.dealerName);
    const photos = ownedUploads(ownerId, req.body?.photos, MAX_PHOTOS_PER_CAR);
    const now = new Date().toISOString();

    const listings = loadListings();
    let listing = listings.find(owned(ownerId, sourceId));
    const fresh = !listing;
    if (!listing) {
      const used = new Set(listings.map((l: any) => l.id));
      let id = Date.now();
      while (used.has(id)) id += 1;
      listing = { id, messages: [], createdAt: now };
      listings.push(listing);
    }

    Object.assign(listing, {
      type: "item",
      trade: true,
      title,
      price,
      description: text(req.body?.description, 4000),
      category: "Motors",
      location: text(req.body?.location, 120) || null,
      condition: text(req.body?.condition, 60) || null,
      details,
      photos,
      bestThumbnail: photos[0] ?? null,
      deviceId: ownerId,
      sellerId: seller.id,
      dealershipId,
      sourceId,
      sellerOrigin: null,
      soldAt: status === "sold" ? listing.soldAt ?? now : null,
      reservedAt: status === "reserved" ? listing.reservedAt ?? now : null,
      // Private: the checked registration and the MOT record. Kept as it was if this update sent none.
      ...(dvlaCheck ? { dvlaCheck } : {}),
    });
    saveListings(listings);

    res.json({ ok: true, created: fresh, listingId: listing.id, status, listing: mediaForListing(toPublicListing(listing), req) });
  });

  /* Take a car off. Its photos go with it; its conversations go with the listing. */
  app.delete("/bridge/dealers/:dealershipId/listings/:sourceId", bridgeAuth, (req: Request, res: Response) => {
    const { dealershipId, sourceId } = req.params;
    if (!idOk(dealershipId) || !idOk(sourceId)) return res.status(400).json({ ok: false, error: "Bad id" });
    const ownerId = dealerOwnerId(dealershipId);

    const listings = loadListings();
    const listing = listings.find(owned(ownerId, sourceId));
    if (!listing) return res.json({ ok: true, removed: false });

    saveListings(listings.filter((l: any) => l !== listing));
    deleteUploads([...(Array.isArray(listing.photos) ? listing.photos : []), listing.bestThumbnail]);
    res.json({ ok: true, removed: true });
  });

  /* What buyers have written since `after` (an ISO time), oldest first. */
  app.get("/bridge/dealers/:dealershipId/messages", bridgeAuth, (req: Request, res: Response) => {
    const { dealershipId } = req.params;
    if (!idOk(dealershipId)) return res.status(400).json({ ok: false, error: "Bad dealership id" });
    const ownerId = dealerOwnerId(dealershipId);

    const after = typeof req.query.after === "string" ? Date.parse(req.query.after) : NaN;
    const out: any[] = [];
    for (const l of loadListings()) {
      if (l.deviceId !== ownerId || !Array.isArray(l.messages)) continue;
      for (const m of l.messages) {
        if (m?.author !== "buyer" || typeof m.threadId !== "string") continue;
        if (Number.isFinite(after) && !(Date.parse(m.timestamp) > after)) continue;
        out.push({
          listingId: l.id,
          sourceId: l.sourceId,
          vehicleTitle: l.title,
          threadId: m.threadId,
          timestamp: m.timestamp,
          text: String(m.message ?? ""),
        });
      }
    }
    out.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    res.json({ ok: true, messages: out.slice(0, MAX_PER_PULL), more: out.length > MAX_PER_PULL });
  });

  /* One conversation, both sides. */
  app.get("/bridge/dealers/:dealershipId/threads/:listingId/:threadId", bridgeAuth, (req: Request, res: Response) => {
    const { dealershipId, listingId, threadId } = req.params;
    if (!idOk(dealershipId)) return res.status(400).json({ ok: false, error: "Bad dealership id" });
    const ownerId = dealerOwnerId(dealershipId);

    const listing = loadListings().find((l: any) => String(l.id) === listingId && l.deviceId === ownerId);
    if (!listing) return res.status(404).json({ ok: false, error: "No such conversation" });
    const thread = (Array.isArray(listing.messages) ? listing.messages : []).filter((m: any) => m?.threadId === threadId);
    if (thread.length === 0) return res.status(404).json({ ok: false, error: "No such conversation" });

    res.json({
      ok: true,
      vehicleTitle: listing.title,
      sourceId: listing.sourceId,
      messages: thread.map((m: any) => ({
        from: m.author === "buyer" ? "buyer" : m.author === "system" ? "system" : "dealer",
        text: String(m.message ?? ""),
        timestamp: m.timestamp,
      })),
    });
  });

  /* The dealership answers someone who wrote to it. It cannot start a conversation. */
  app.post("/bridge/dealers/:dealershipId/threads/:listingId/:threadId/reply", bridgeAuth, (req: Request, res: Response) => {
    const { dealershipId, listingId, threadId } = req.params;
    if (!idOk(dealershipId)) return res.status(400).json({ ok: false, error: "Bad dealership id" });
    const ownerId = dealerOwnerId(dealershipId);

    const message = text(req.body?.message, MAX_MESSAGE_LENGTH + 1);
    if (!message) return res.status(400).json({ ok: false, error: "Missing message" });
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ ok: false, error: `Messages can be up to ${MAX_MESSAGE_LENGTH} characters` });
    }

    const listings = loadListings();
    const listing = listings.find((l: any) => String(l.id) === listingId && l.deviceId === ownerId);
    const buyerMessage = listing?.messages?.find((m: any) => m?.threadId === threadId && m.author === "buyer");
    if (!listing || !buyerMessage) return res.status(404).json({ ok: false, error: "No such conversation" });

    if (isBlockedEitherWay(ownerId, buyerMessage.deviceId)) {
      return res.status(403).json({ ok: false, error: "This person isn't taking messages from you." });
    }
    // The thread id is derived, so a wrong one cannot land in someone else's chat.
    if (threadIdFor(listing.id, buyerMessage.deviceId) !== threadId) {
      return res.status(404).json({ ok: false, error: "No such conversation" });
    }

    listing.messages.push({ author: "seller", message, deviceId: ownerId, threadId, timestamp: new Date().toISOString() });
    saveListings(listings);
    res.json({ ok: true });
  });
}
